/* FILE: api/chat.js
   PURPOSE: Zoya Backend (FINAL POLISHED VERSION)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
const MODEL_NAME = 'gemini-2.5-flash'; 

// --- 2. KNOWLEDGE BASE (Optimized for Speed) ---
const KNOWLEDGE_BASE = `
[RULES]
- UNBOXING VIDEO: MANDATORY for returns. 360-degree clear video required.
- COD: Unavailable. Online payment only.
- RETURNS: Damaged/Wrong items only. Customer must ship via India Post.
- CANCELLATION: Impossible after dispatch.

[SHIPPING]
- Dispatch: 24-48 Hours.
- Delivery: DTDC/Professional (6-9 days), India Post (9-15 days).
- Delays: +2-3 days for holidays/weather.
- Return to Sender: If undelivered due to wrong address, reshipping charges apply.

[QUALITY & CARE]
- Warranty: None. Lifespan 3-6 months (color/shine).
- Water: Splash-proof but avoid swimming/perfume.
- Material: Brass + Micro-Gold Plating + AAA+ Stones.

[CONTACT]
- Call: +91 8100 180 190 (Hindi Only).
- Chat: English, Hindi, Bengali.
`;

// --- 3. HELPER: FETCH ORDER (Robust) ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        try {
            const ck = process.env.WOO_CONSUMER_KEY;
            const cs = process.env.WOO_CONSUMER_SECRET;

            if (!ck || !cs || !orderId) { resolve({ found: false }); return; }

            const auth = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
            const reqUrl = SITE_URL + '/wp-json/wc/v3/orders/' + orderId;
            
            const req = https.request(reqUrl, {
                method: 'GET',
                headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const order = JSON.parse(data);
                            const items = (order.line_items || []).map(i => i.name).join(", ");
                            resolve({ found: true, id: order.id, status: order.status, items: items });
                        } else {
                            resolve({ found: false });
                        }
                    } catch (e) { resolve({ found: false }); }
                });
            });
            req.on('error', () => resolve({ found: false }));
            req.end();
        } catch (e) { resolve({ found: false }); }
    });
};

// --- 4. MAIN HANDLER ---
module.exports = async (req, res) => {
    // Standard CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) return res.status(200).json({ text: "System Error: API Key Missing" });

        // Parse Body safely
        let bodyData = req.body;
        if (typeof bodyData === 'string') { try { bodyData = JSON.parse(bodyData); } catch (e) {} }
        
        const contents = bodyData?.contents;
        if (!contents?.length) return res.status(200).json({ text: "Hello! Zoya is ready." });

        const lastMessage = contents[contents.length - 1].parts[0].text;

        // --- ORDER CHECK LOGIC ---
        let orderContext = "";
        const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);

        if (orderMatch) {
            const orderData = await checkOrder(orderMatch[1]);
            if (orderData.found) {
                // Smart Status Descriptions
                let statusDesc = orderData.status;
                if (statusDesc === 'processing') statusDesc = "Processing (Being Packed)";
                if (statusDesc === 'completed') statusDesc = "Completed (Shipped/Delivered)";
                if (statusDesc === 'on-hold') statusDesc = "On Hold (Payment Pending)";
                
                orderContext = `\n[SYSTEM DATA: Order #${orderData.id} is ${statusDesc}. Items: ${orderData.items}]\n`;
            } else {
                orderContext = `\n[SYSTEM DATA: Order #${orderMatch[1]} NOT found in database.]\n`;
            }
        }

        // --- PERSONA & RULES ---
        let systemRule = "You are Zoya, a helpful human assistant for Owao Jewels. " +
                         "Keep answers SHORT (2 sentences max). " +
                         "Talk naturally. " +
                         KNOWLEDGE_BASE + orderContext;

        // Language Mode
        const lang = bodyData.language || 'en-US';
        if (lang === 'hi-IN') systemRule += " \nOUTPUT: Hindi (Devanagari) + Hinglish (Roman) in brackets.";
        else if (lang === 'bn-BD') systemRule += " \nOUTPUT: Bengali + Roman Bengali in brackets.";
        else systemRule += " \nOUTPUT: Polite English.";

        // --- SEND TO GEMINI ---
        const finalUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        const postData = JSON.stringify({ contents, system_instruction: { parts: { text: systemRule } } });

        const reqGoogle = https.request(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (resGoogle) => {
            let responseBody = '';
            resGoogle.on('data', (c) => responseBody += c);
            resGoogle.on('end', () => {
                try {
                    const data = JSON.parse(responseBody);
                    // Use a default polite error if Google fails, don't show technical jargon
                    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I am having a little trouble connecting right now. Please try again in a moment! 🩷";
                    res.status(200).json({ text: reply });
                } catch (e) { 
                    res.status(200).json({ text: "Connection error. Please try again." }); 
                }
            });
        });

        reqGoogle.write(postData);
        reqGoogle.end();

    } catch (e) {
        // If the server crashes, fail silently and politely
        console.error(e);
        res.status(200).json({ text: "I am currently offline. Please refresh the page." });
    }
};
