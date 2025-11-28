/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Bulletproof Debugger Version)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
const MODEL_NAME = 'gemini-1.5-flash'; 

const KNOWLEDGE_BASE = `
[POLICIES]
- Warranty: 6 Months on Plating/Color.
- Returns: 7-Day return policy for damaged/wrong items only. Requires Unboxing Video.
- Shipping: Free above ₹499. Takes 5-7 days.
- COD: Not available currently. Online payment only.
- Exchange: Not available.

[CONTACT]
- Phone: +91 8100 180 190 (Hindi Calls Only)
`;

// --- 2. HELPER: FETCH ORDER (Safely) ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        try {
            const ck = process.env.WOO_CONSUMER_KEY;
            const cs = process.env.WOO_CONSUMER_SECRET;

            if (!ck || !cs || !orderId) { 
                resolve({ found: false, error: "Missing Keys" }); 
                return; 
            }

            // Safe Base64 encoding
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
            resolve({ found: false }); // Fail silently if helper crashes
        }
    });
};

// --- 3. MAIN HANDLER (With Safety Net) ---
module.exports = async (req, res) => {
    // A. CORS HEADERS (Must be first)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // --- START OF SAFETY NET ---

        // B. API KEY CHECK
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in Vercel Settings.");
        }

        // C. PARSE BODY (Handle string or object)
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) {}
        }
        
        const contents = bodyData ? bodyData.contents : null;
        
        // Check if contents is valid
        if (!contents || !Array.isArray(contents) || contents.length === 0) {
             return res.status(200).json({ text: "👋 Hello! I am Zoya. (System Ready)" });
        }

        const lastPart = contents[contents.length - 1].parts;
        if (!lastPart || !lastPart[0] || !lastPart[0].text) {
             return res.status(200).json({ text: "👋 I am listening..." });
        }

        const lastMessage = lastPart[0].text;

        // D. ORDER CHECK LOGIC
        let orderInfoText = "";
        const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);

        if (orderMatch) {
            const orderId = orderMatch[1];
            const orderData = await checkOrder(orderId);
            
            if (orderData && orderData.found) {
                orderInfoText = "\n[SYSTEM DATA: Order #" + orderData.id + " is " + orderData.status + ". Items: " + orderData.items + "]\n";
            } else {
                orderInfoText = "\n[SYSTEM DATA: checked for order #" + orderId + " but found nothing.]\n";
            }
        }

        // E. PREPARE GEMINI REQUEST
        let systemRule = "You are Zoya, helpful AI for Owao Jewels. Keep answers short. " + KNOWLEDGE_BASE + orderInfoText;

        const postData = JSON.stringify({
            contents: contents,
            system_instruction: { parts: { text: systemRule } }
        });

        // F. SEND TO GOOGLE
        // Safe URL creation
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
            return new Promise((resolve, reject) => {
                const reqGoogle = https.request(options, (resGoogle) => {
                    let responseBody = '';
                    resGoogle.on('data', (chunk) => responseBody += chunk);
                    resGoogle.on('end', () => {
                        try {
                            const data = JSON.parse(responseBody);
                            if (data.error) {
                                resolve("⚠ Google Error: " + data.error.message);
                            } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                                resolve(data.candidates[0].content.parts[0].text);
                            } else {
                                resolve("⚠ Empty Response from AI. (Debug: " + JSON.stringify(data) + ")");
                            }
                        } catch (e) {
                            resolve("⚠ Parse Error from Google: " + e.message);
                        }
                    });
                });
                
                reqGoogle.on('error', (e) => resolve("⚠ Network Error connecting to Google: " + e.message));
                reqGoogle.write(postData);
                reqGoogle.end();
            });
        };

        const aiText = await getAIResponse();
        return res.status(200).json({ text: aiText });

    } catch (criticalError) {
        // --- SAFETY NET CATCHES THE CRASH HERE ---
        console.error("SERVER CRASH:", criticalError);
        return res.status(200).json({ 
            text: "🛑 CRASH REPORT: " + criticalError.message + "\n(Show this to the developer)"
        });
    }
};
