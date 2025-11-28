/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Full Policy Integration + Safe Syntax)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
// We use the standard 1.5 Flash model. 
// "2.5" does not exist and will cause crashes.
const MODEL_NAME = 'gemini-1.5-flash'; 

// --- 2. THE KNOWLEDGE BASE (Extracted from your 8 Photos) ---
const KNOWLEDGE_BASE = `
[CRITICAL RULES - READ FIRST]
1. UNBOXING VIDEO: A clear 360-degree unboxing video is MANDATORY for any return claim. No video = No return.
2. COD: Cash on Delivery is CURRENTLY UNAVAILABLE. Online payment only.
3. RETURNS: Only accepted for Damaged or Wrong products.
4. RETURN METHOD: Customer must ship the return via "India Post Office".
5. CANCELLATION: Not possible once the order is dispatched.

[SHIPPING & DELIVERY]
- Processing Time: 24-48 Hours.
- DTDC / Professional Courier: 6-9 Business Days.
- India Post: 9-15 Business Days.
- Delays: Please allow extra 2-3 days for holidays/weather.
- Missed Delivery: If returned due to wrong address/unavailability, Courier & Repacking charges apply for reshipping.

[REFUNDS]
- Timing: 5-7 Business Days after return is approved.
- Method: Refunded to the original payment source.
- Deductions: Shipping charges are deducted if the return is due to customer error (e.g., wrong address).

[QUALITY & WARRANTY]
- Material: Brass with Micro-Gold Plating. AAA+ Stones.
- Warranty: NO Warranty or Guarantee.
- Lifespan: 3-6 Months (Color/Shine) with proper care.
- Water: Daily wear safe (splash resistant), but remove before swimming/bathing.
- Care: Avoid perfume/sweat. Store in an air-tight pouch (zip lock).

[CONTACT]
- Phone: +91 8100 180 190 (Hindi Calls Only).
- Chat: English, Hindi, Bengali.
`;

// --- 3. HELPER: FETCH ORDER (Safely) ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        try {
            const ck = process.env.WOO_CONSUMER_KEY;
            const cs = process.env.WOO_CONSUMER_SECRET;

            if (!ck || !cs || !orderId) { 
                resolve({ found: false }); 
                return; 
            }

            // Safe Syntax (No backticks to prevent copy-paste errors)
            const authString = ck + ':' + cs;
            const auth = 'Basic ' + Buffer.from(authString).toString('base64');
            
            const reqUrl = SITE_URL + '/wp-json/wc/v3/orders/' + orderId;
            const options = {
                method: 'GET',
                headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
            };

            const req = https.request(reqUrl, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const order = JSON.parse(data);
                            let itemsList = "items";
                            if (order.line_items && Array.isArray(order.line_items)) {
                                itemsList = order.line_items.map(function(i) { return i.name; }).join(", ");
                            }
                            resolve({ found: true, id: order.id, status: order.status, items: itemsList });
                        } else {
                            resolve({ found: false });
                        }
                    } catch (e) { resolve({ found: false }); }
                });
            });

            req.on('error', () => resolve({ found: false }));
            req.end();
        } catch (e) {
            resolve({ found: false });
        }
    });
};

// --- 4. MAIN HANDLER ---
module.exports = async (req, res) => {
    // A. CORS HEADERS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // B. API KEY CHECK
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return res.status(200).json({ text: "🛑 Error: GEMINI_API_KEY is missing in Vercel." });
        }

        // C. PARSE INPUT
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) {}
        }
        
        const contents = bodyData ? bodyData.contents : null;
        if (!contents || !Array.isArray(contents) || contents.length === 0) {
             return res.status(200).json({ text: "👋 Zoya is online. (System Ready)" });
        }

        const lastPart = contents[contents.length - 1].parts;
        const lastMessage = (lastPart && lastPart[0]) ? lastPart[0].text : "";

        // D. ORDER CHECK LOGIC
        let orderInfoText = "";
        const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);

        if (orderMatch) {
            const orderId = orderMatch[1];
            const orderData = await checkOrder(orderId);
            
            if (orderData && orderData.found) {
                orderInfoText = "\n[SYSTEM DATA: Order #" + orderData.id + " is " + orderData.status + ". Items: " + orderData.items + "]\n";
            } else {
                orderInfoText = "\n[SYSTEM DATA: checked for order #" + orderId + " but found nothing. Ask user to check the number.]\n";
            }
        }

        // E. PREPARE PERSONA
        let systemRule = "You are Zoya, the AI assistant for Owao Jewels. " +
                         "You are a 23-year-old human female, NOT a robot. Talk casually and politely. " +
                         "Keep answers SHORT (max 2-3 sentences). " +
                         "Never repeat the exact same phrasing. " +
                         "Use emojis naturally (✨, 🩷). " +
                         KNOWLEDGE_BASE + orderInfoText;

        // Language specific instruction
        const language = bodyData.language || 'en-US';
        if (language === 'hi-IN') {
            systemRule += " \nOUTPUT RULE: Answer in Hindi (Devanagari) followed by Roman Hindi (Hinglish) in parentheses.";
        } else if (language === 'bn-BD') {
            systemRule += " \nOUTPUT RULE: Answer in Bengali (Bangla script) followed by Roman Bengali in parentheses.";
        } else {
            systemRule += " \nOUTPUT RULE: Answer in polite English.";
        }

        // F. SEND TO GOOGLE
        const postData = JSON.stringify({
            contents: contents,
            system_instruction: { parts: { text: systemRule } }
        });

        // FIXED URL CONSTRUCTION
        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_NAME + ':generateContent';
        const finalUrl = baseUrl + '?key=' + API_KEY;
        const myUrl = new URL(finalUrl);

        const options = {
            hostname: myUrl.hostname,
            path: myUrl.pathname + myUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const getAIResponse = () => {
            return new Promise((resolve) => {
                const reqGoogle = https.request(options, (resGoogle) => {
                    let responseBody = '';
                    resGoogle.on('data', (chunk) => responseBody += chunk);
                    resGoogle.on('end', () => {
                        try {
                            const data = JSON.parse(responseBody);
                            if (data.error) {
                                // If 1.5 Flash fails, we show the error cleanly
                                resolve("⚠ Zoya Brain Error: " + data.error.message);
                            } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                                resolve(data.candidates[0].content.parts[0].text);
                            } else {
                                resolve("⚠ No response from Zoya.");
                            }
                        } catch (e) {
                            resolve("⚠ Connection Error.");
                        }
                    });
                });
                
                reqGoogle.on('error', (e) => resolve("⚠ Network Error."));
                reqGoogle.write(postData);
                reqGoogle.end();
            });
        };

        const aiText = await getAIResponse();
        return res.status(200).json({ text: aiText });

    } catch (criticalError) {
        console.error("SERVER CRASH:", criticalError);
        return res.status(200).json({ text: "🛑 Critical Error: " + criticalError.message });
    }
};
