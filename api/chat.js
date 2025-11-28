/* FILE: api/chat.js
   PURPOSE: Zoya Backend (X-RAY DEBUG VERSION)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
const MODEL_NAME = 'gemini-2.5-flash'; 

const KNOWLEDGE_BASE = `
[CRITICAL RULES]
- Unboxing Video: MANDATORY for returns.
- COD: Unavailable.
- Returns: Damaged/Wrong items only. Via India Post.
- Contact: +91 8100 180 190.
`;

// --- 2. HELPER: FETCH ORDER (WITH ERROR REVEAL) ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        try {
            const ck = process.env.WOO_CONSUMER_KEY;
            const cs = process.env.WOO_CONSUMER_SECRET;

            if (!ck || !cs) { 
                resolve({ found: false, debug: "KEYS_MISSING_IN_VERCEL" }); 
                return; 
            }

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
                    if (res.statusCode === 200) {
                        try {
                            const order = JSON.parse(data);
                            let itemsList = "items";
                            if (order.line_items) {
                                itemsList = order.line_items.map(function(i) { return i.name; }).join(", ");
                            }
                            resolve({ found: true, id: order.id, status: order.status, items: itemsList });
                        } catch (e) {
                            resolve({ found: false, debug: "JSON_PARSE_ERROR" });
                        }
                    } else {
                        // *** X-RAY: Capture the exact error code ***
                        resolve({ found: false, debug: "API_ERROR_" + res.statusCode });
                    }
                });
            });

            req.on('error', (e) => resolve({ found: false, debug: "NETWORK_" + e.message }));
            req.end();
        } catch (e) {
            resolve({ found: false, debug: "CRASH_" + e.message });
        }
    });
};

// --- 3. MAIN HANDLER ---
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const bodyData = req.body;
        const contents = bodyData ? bodyData.contents : null;
        
        if (!contents) return res.status(200).json({ text: "Zoya X-Ray Ready." });

        const lastMessage = contents[contents.length - 1].parts[0].text;
        
        // --- ORDER LOOKUP ---
        let orderInfoText = "";
        const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);

        if (orderMatch) {
            const orderId = orderMatch[1];
            const orderData = await checkOrder(orderId);
            
            if (orderData && orderData.found) {
                orderInfoText = `\n[SYSTEM: SUCCESS! Found Order #${orderData.id}. Status: ${orderData.status}.]\n`;
            } else {
                // *** TELL THE USER THE ERROR ***
                const debugCode = orderData ? orderData.debug : "UNKNOWN";
                orderInfoText = `\n[SYSTEM ALERT: CONNECTION FAILED. Error Code: ${debugCode}. Inform the user exactly what this code is.]\n`;
            }
        }

        let systemRule = `You are Zoya. ${KNOWLEDGE_BASE} ${orderInfoText} If you see a SYSTEM ALERT with an Error Code, tell the user: "I am getting Error Code: [Insert Code Here]. Please tell the developer."`;

        const postData = JSON.stringify({ contents: contents, system_instruction: { parts: { text: systemRule } } });

        const finalUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_NAME + ':generateContent?key=' + API_KEY;
        const myUrl = new URL(finalUrl);

        const options = {
            hostname: myUrl.hostname,
            path: myUrl.pathname + myUrl.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };

        const reqGoogle = https.request(options, (resGoogle) => {
            let responseBody = '';
            resGoogle.on('data', (chunk) => responseBody += chunk);
            resGoogle.on('end', () => {
                try {
                    const data = JSON.parse(responseBody);
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No Text";
                    res.status(200).json({ text: text });
                } catch (e) { res.status(200).json({ text: "Error parsing Google response." }); }
            });
        });
        reqGoogle.write(postData);
        reqGoogle.end();

    } catch (e) {
        res.status(200).json({ text: "Crash: " + e.message });
    }
};
