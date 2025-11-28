/* FILE: api/chat.js
   PURPOSE: Zoya Backend (DEBUG VERSION - Shows Real Error)
*/

const https = require('https');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com';
// ** CRITICAL FIX: Using the Stable 1.5 Model **
const MODEL_NAME = 'gemini-1.5-flash'; 

const KNOWLEDGE_BASE = `
[POLICIES]
- Warranty: 6 Months on Plating/Color.
- Returns: 7-Day return policy for damaged/wrong items only. Requires Unboxing Video.
- Shipping: Free above ₹499. Takes 5-7 days.
- COD: Not available currently. Online payment only.
- Exchange: Not available.
`;

// --- 2. HELPER: FETCH ORDER ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        const ck = process.env.WOO_CONSUMER_KEY;
        const cs = process.env.WOO_CONSUMER_SECRET;

        if (!ck || !cs || !orderId) { resolve(null); return; }

        const authString = ck + ':' + cs;
        const auth = 'Basic ' + Buffer.from(authString).toString('base64');
        
        const options = {
            method: 'GET',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
        };

        const reqUrl = SITE_URL + '/wp-json/wc/v3/orders/' + orderId;

        const req = https.request(reqUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const order = JSON.parse(data);
                        let itemsList = order.line_items ? order.line_items.map(i => i.name).join(", ") : "items";
                        resolve({ found: true, id: order.id, status: order.status, items: itemsList });
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

// --- 3. MAIN HANDLER ---
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(200).json({ text: "🛑 System Error: GEMINI_API_KEY is missing in Vercel." });

  const { contents, language } = req.body || {};
  if (!contents) return res.status(200).json({ text: "Hello! I am ready." });

  // --- ORDER CHECK ---
  const lastMessage = contents[contents.length - 1].parts[0].text;
  const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);
  let orderInfoText = ""; 
  
  if (orderMatch) {
      const orderData = await checkOrder(orderMatch[1]);
      if (orderData && orderData.found) {
          orderInfoText = \n[SYSTEM: Order #${orderData.id} is ${orderData.status}. Items: ${orderData.items}]\n;
      } else if (orderData && !orderData.found) {
          orderInfoText = \n[SYSTEM: Order #${orderMatch[1]} NOT FOUND.]\n;
      }
  }

  // --- PERSONA ---
  let systemRule = You are Zoya, friendly AI for Owao Jewels. Help politely. Short answers. ${KNOWLEDGE_BASE} ${orderInfoText};

  const postData = JSON.stringify({
    contents: contents,
    system_instruction: { parts: { text: systemRule } }
  });

  // Using the Safe URL Construction
  const link = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_NAME + ':generateContent?key=' + API_KEY;
  const myUrl = new URL(link);

  const options = {
    hostname: myUrl.hostname,
    path: myUrl.pathname + myUrl.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const getAIResponse = () => {
    return new Promise((resolve) => {
      const reqGoogle = https.request(options, (resGoogle) => {
        let responseBody = '';
        resGoogle.on('data', (chunk) => { responseBody += chunk; });
        resGoogle.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            
            // --- DEBUG LOGGING ---
            console.log("GOOGLE RESPONSE:", JSON.stringify(data)); 

            if (data.error) {
              resolve({ text: '🛑 API Error: ' + data.error.message });
            } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              resolve({ text: data.candidates[0].content.parts[0].text });
            } else {
              // *** THIS IS THE DEBUG PART ***
              // If text is missing, we send the RAW JSON to the user to see what happened.
              resolve({ text: '⚠ DEBUG INFO: ' + JSON.stringify(data) });
            }
          } catch (e) {
            resolve({ text: '🛑 Parse Error: ' + e.message + " | Raw: " + responseBody });
          }
        });
      });
      reqGoogle.on('error', (e) => { resolve({ text: '🛑 Network Error: ' + e.message }); });
      reqGoogle.write(postData);
      reqGoogle.end();
    });
  };

  const result = await getAIResponse();
  return res.status(200).json(result);
};
