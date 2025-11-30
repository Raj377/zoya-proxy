/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Separated Scripts + Emojis + Order Logic)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
const MODEL_NAME = 'gemini-2.5-flash'; 

// --- 2. KNOWLEDGE BASE ---
const KNOWLEDGE_BASE = `
[RULES]
- UNBOXING VIDEO: MANDATORY for returns. 360-degree clear video required.
- COD: Unavailable. Online payment only.
- RETURNS: Damaged/Wrong items only. Via India Post.
- CANCELLATION: Impossible after dispatch.

[SHIPPING & CONTACT]
- Dispatch: 24-48 Hours. Delivery: 6-15 Days.
- Call: +91 8100 180 190 (Hindi). Chat: English/Hindi/Bengali.
`;

// --- 3. HELPER: GENERIC WOOCOMMERCE FETCHER ---
const wooFetch = (endpoint, ck, cs) => {
    return new Promise((resolve) => {
        if (!ck || !cs) { resolve(null); return; }
        const auth = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
        const req = https.request(`${SITE_URL}/wp-json/wc/v3/${endpoint}`, {
            method: 'GET',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
};

// --- 4. DATA FETCHING LOGIC ---

// A. Check Order
const getOrderData = async (msg, userId, ck, cs) => {
    const match = msg.match(/(?:order|#)?\s*(\d{4,})/i);
    if (match) {
        const order = await wooFetch(`orders/${match[1]}`, ck, cs);
        if (order) return `\n[SYSTEM: Order #${order.id} is ${order.status}. Items: ${order.line_items.map(i=>i.name).join(', ')}]\n`;
        return `\n[SYSTEM: Order #${match[1]} NOT FOUND.]\n`;
    } 
    if (userId && userId !== '0' && msg.toLowerCase().includes('order')) {
        const orders = await wooFetch(`orders?customer=${userId}&per_page=1`, ck, cs);
        if (orders && orders.length > 0) {
            return `\n[SYSTEM: User's Latest Order #${orders[0].id} is ${orders[0].status}.]\n`;
        }
    }
    return "";
};

// B. Check Customer Profile (Clean)
const getCustomerData = async (userId, ck, cs) => {
    if (!userId || userId === '0') return "";
    const c = await wooFetch(`customers/${userId}`, ck, cs);
    if (!c) return "";
    const addr = c.billing ? `${c.billing.city}, ${c.billing.state}` : "Unknown";
    return `\n[USER PROFILE: Name: ${c.first_name} ${c.last_name}, City: ${addr}]\n`;
};

// C. Check Products
const getProductData = async (msg, ck, cs) => {
    const keywords = ['price', 'cost', 'buy', 'stock', 'available', 'show', 'looking', 'size', 'color', 'ring', 'necklace', 'earring'];
    const hasKeyword = keywords.some(k => msg.toLowerCase().includes(k));
    if (!hasKeyword) return "";

    const query = msg.replace(/(what is|how much|price of|show me|do you have|the)/gi, '').trim();
    if (query.length < 3) return "";

    const products = await wooFetch(`products?search=${encodeURIComponent(query)}&per_page=3`, ck, cs);
    if (!products || products.length === 0) return "";

    let info = "\n[PRODUCT RESULTS]:\n";
    products.forEach(p => {
        const stock = p.stock_status === 'instock' ? "In Stock" : "Out of Stock";
        const price = p.sale_price ? `₹${p.sale_price} (Sale!)` : `₹${p.regular_price}`;
        info += `- ${p.name}: ${price}, ${stock}.\n`;
    });
    return info;
};

// --- 5. MAIN HANDLER ---
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const ck = process.env.WOO_CONSUMER_KEY;
        const cs = process.env.WOO_CONSUMER_SECRET;

        if (!API_KEY) return res.status(200).json({ text: "Error: API Key Missing." });

        let bodyData = req.body;
        if (typeof bodyData === 'string') { try { bodyData = JSON.parse(bodyData); } catch (e) {} }
        
        const contents = bodyData?.contents;
        const userId = bodyData?.userId;
        
        if (!contents?.length) return res.status(200).json({ text: "Zoya is ready." });

        const lastMessage = contents[contents.length - 1].parts[0].text;

        const [orderInfo, userInfo, productInfo] = await Promise.all([
            getOrderData(lastMessage, userId, ck, cs),
            getCustomerData(userId, ck, cs),
            getProductData(lastMessage, ck, cs)
        ]);

        const fullContext = orderInfo + userInfo + productInfo;

        let systemRule = "You are Zoya, the AI manager of Owao Jewels. " +
                         "Use the SYSTEM data provided to answer. " +
                         "Keep answers SHORT (max 3 sentences) and warm. " +
                         "ALWAYS use 1-2 Emojis (✨, 🩷, 💎) in every reply. " +
                         KNOWLEDGE_BASE + fullContext;

        // --- UPDATED LANGUAGE LOGIC (SEPARATE SCRIPTS) ---
        const lang = bodyData.language || 'en-US';
        if (lang === 'hi-IN') {
            systemRule += " \nOUTPUT FORMAT: 1. Write the FULL response in Hindi (Devanagari) with Emojis. 2. Add two newlines (gap). 3. Then write the full English script/translation in parentheses ().";
        } else if (lang === 'bn-BD') {
            systemRule += " \nOUTPUT FORMAT: 1. Write the FULL response in Bengali (Bangla Script) with Emojis. 2. Add two newlines (gap). 3. Then write the full English script/translation in parentheses ().";
        } else {
            systemRule += " \nOUTPUT FORMAT: Polite English with Emojis.";
        }

        const reqGoogle = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        }, (resGoogle) => {
            let data = '';
            resGoogle.on('data', c => data += c);
            resGoogle.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        res.status(200).json({ text: "⚠️ Model Error: " + json.error.message });
                    } else if (json.candidates && json.candidates[0] && json.candidates[0].content) {
                        let reply = json.candidates[0].content.parts[0].text;
                        res.status(200).json({ text: reply });
                    } else {
                        res.status(200).json({ text: "⚠️ Empty Response from AI." });
                    }
                } catch (e) { res.status(200).json({ text: "Connection error." }); }
            });
        });

        reqGoogle.write(JSON.stringify({ contents, system_instruction: { parts: { text: systemRule } } }));
        reqGoogle.end();

    } catch (e) { res.status(200).json({ text: "Server Offline." }); }
};
