/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Ultimate Version: Orders + Products + Customer Profile)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
const MODEL_NAME = 'gemini-1.5-flash'; 

// --- 2. KNOWLEDGE BASE (Policies) ---
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

// A. Check Order (By ID or Latest)
const getOrderData = async (msg, userId, ck, cs) => {
    // 1. Check for specific number
    const match = msg.match(/(?:order|#)?\s*(\d{4,})/i);
    if (match) {
        const order = await wooFetch(`orders/${match[1]}`, ck, cs);
        if (order) return `\n[SYSTEM: Order #${order.id} is ${order.status}. Items: ${order.line_items.map(i=>i.name).join(', ')}]\n`;
        return `\n[SYSTEM: Order #${match[1]} NOT FOUND.]\n`;
    } 
    // 2. Check latest if user is logged in
    if (userId && userId !== '0' && msg.toLowerCase().includes('order')) {
        const orders = await wooFetch(`orders?customer=${userId}&per_page=1`, ck, cs);
        if (orders && orders.length > 0) {
            return `\n[SYSTEM: User's Latest Order #${orders[0].id} is ${orders[0].status}.]\n`;
        }
    }
    return "";
};

// B. Check Customer Profile (Wallet, Address, Name)
const getCustomerData = async (userId, ck, cs) => {
    if (!userId || userId === '0') return "";

    const c = await wooFetch(`customers/${userId}`, ck, cs);
    if (!c) return "";

    // Wallet Logic: Look for common wallet keys in meta_data
    let wallet = "0";
    if (c.meta_data) {
        const wInfo = c.meta_data.find(m => m.key === '_woo_wallet_balance' || m.key === '_tera_wallet_balance' || m.key === 'current_balance');
        if (wInfo) wallet = wInfo.value;
    }

    const addr = c.billing ? `${c.billing.city}, ${c.billing.state}` : "Unknown";
    
    return `\n[USER PROFILE: Name: ${c.first_name} ${c.last_name}, Email: ${c.email}, Phone: ${c.billing.phone}, City: ${addr}, WALLET BALANCE: ₹${wallet}]\n`;
};

// C. Search Products (Price, Stock, Attributes)
const getProductData = async (msg, ck, cs) => {
    // Only search if keywords are present
    const keywords = ['price', 'cost', 'buy', 'stock', 'available', 'show', 'looking for', 'size', 'color'];
    const hasKeyword = keywords.some(k => msg.toLowerCase().includes(k));
    
    if (!hasKeyword) return "";

    // Simple search using the whole message as query (WooCommerce handles fuzzy search)
    // We clean it slightly to improve results
    const query = msg.replace(/(what is|how much|price of|show me|do you have|the)/gi, '').trim();
    if (query.length < 3) return "";

    const products = await wooFetch(`products?search=${encodeURIComponent(query)}&per_page=3`, ck, cs);
    
    if (!products || products.length === 0) return "";

    let info = "\n[PRODUCT SEARCH RESULTS]:\n";
    products.forEach(p => {
        const stock = p.stock_status === 'instock' ? "In Stock" : "Out of Stock";
        const attrs = p.attributes.map(a => `${a.name}: ${a.options.join('/')}`).join(', ');
        const price = p.sale_price ? `₹${p.sale_price} (Sale!)` : `₹${p.regular_price}`;
        info += `- ${p.name}: ${price}, ${stock}. Details: ${attrs}\n`;
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

        if (!API_KEY) return res.status(200).json({ text: "System Error: API Key Missing" });

        let bodyData = req.body;
        if (typeof bodyData === 'string') { try { bodyData = JSON.parse(bodyData); } catch (e) {} }
        
        const contents = bodyData?.contents;
        const userId = bodyData?.userId;
        
        if (!contents?.length) return res.status(200).json({ text: "Zoya is ready." });

        const lastMessage = contents[contents.length - 1].parts[0].text;

        // --- PARALLEL DATA FETCHING ---
        // We fetch Order, Profile, and Product data at the same time to be fast
        const [orderInfo, userInfo, productInfo] = await Promise.all([
            getOrderData(lastMessage, userId, ck, cs),
            getCustomerData(userId, ck, cs),
            getProductData(lastMessage, ck, cs)
        ]);

        const fullContext = orderInfo + userInfo + productInfo;

        // --- PERSONA ---
        let systemRule = "You are Zoya, the AI manager of Owao Jewels. " +
                         "You have access to the user's live profile, wallet, and inventory. " +
                         "Use this data to answer accurately. " +
                         "Keep answers SHORT and polite. " +
                         KNOWLEDGE_BASE + fullContext;

        const lang = bodyData.language || 'en-US';
        if (lang === 'hi-IN') systemRule += " \nOUTPUT: Hindi + Hinglish (Roman) in brackets.";
        else if (lang === 'bn-BD') systemRule += " \nOUTPUT: Bengali + Roman Bengali in brackets.";
        else systemRule += " \nOUTPUT: Polite English.";

        // --- SEND TO GEMINI ---
        const reqGoogle = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        }, (resGoogle) => {
            let data = '';
            resGoogle.on('data', c => data += c);
            resGoogle.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    res.status(200).json({ text: json.candidates?.[0]?.content?.parts?.[0]?.text || "I am checking..." });
                } catch (e) { res.status(200).json({ text: "Connection error." }); }
            });
        });

        reqGoogle.write(JSON.stringify({ contents, system_instruction: { parts: { text: systemRule } } }));
        reqGoogle.end();

    } catch (e) { res.status(200).json({ text: "Server Offline." }); }
};
