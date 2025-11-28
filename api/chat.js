/* FILE: api/chat.js
   PURPOSE: Zoya Backend Level 2 (Safer Syntax Version)
*/

const https = require('https');
const url = require('url');

// --- 1. CONFIGURATION ---
const SITE_URL = 'https://www.owaojewels.com'; // Your Website
const KNOWLEDGE_BASE = `
[POLICIES]
- Warranty: 6 Months on Plating/Color.
- Returns: 7-Day return policy for damaged/wrong items only. Requires Unboxing Video.
- Shipping: Free above ₹499. Takes 5-7 days.
- COD: Not available currently. Online payment only.
- Exchange: Not available.

[QUALITY]
- Material: Brass/Copper with Micro-Gold Plating.
- Stones: AAA American Diamonds.
- Skin: Nickel-free, Lead-free, Anti-allergic.
- Water: Water-resistant (splash proof), but avoid perfume/swimming to save warranty.

[CONTACT & ESCALATION]
- Phone/WhatsApp: +91 8100 180 190
- Calling Language: Hindi ONLY.
- Chat/WhatsApp Language: English, Hindi, Bengali.
`;

// --- 2. HELPER: FETCH ORDER FROM WOOCOMMERCE ---
const checkOrder = (orderId) => {
    return new Promise((resolve) => {
        // Get keys from Vercel Environment Variables
        const ck = process.env.WOO_CONSUMER_KEY;
        const cs = process.env.WOO_CONSUMER_SECRET;

        if (!ck || !cs || !orderId) {
            resolve(null); // No keys or ID, skip lookup
            return;
        }

        // --- SAFE FIX 1: Using '+' instead of backticks ---
        const authString = ck + ':' + cs;
        const auth = 'Basic ' + Buffer.from(authString).toString('base64');
        
        const options = {
            method: 'GET',
            headers: { 
                'Authorization': auth,
                'Content-Type': 'application/json'
            }
        };

        // --- SAFE FIX 2: Using '+' instead of backticks ---
        const reqUrl = SITE_URL + '/wp-json/wc/v3/orders/' + orderId;

        const req = https.request(reqUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 404) {
                        resolve({ found: false });
                    } else if (res.statusCode === 200) {
                        const order = JSON.parse(data);
                        
                        // Handle items list safely
                        let itemsList = "items";
                        if (order.line_items) {
                             itemsList = order.line_items.map(function(i) { return i.name; }).slice(0, 2).join(", ");
                        }

                        resolve({
                            found: true,
                            id: order.id,
                            status: order.status,
                            date: order.date_created,
                            total: order.total,
                            currency: order.currency_symbol,
                            items: itemsList
                        });
                    } else {
                        resolve(null); // Error or unauthorized
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.end();
    });
};

// --- 3. MAIN HANDLER ---
module.exports = async (req, res) => {
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // API Check
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(200).json({ text: "🛑 System Error: API Key is missing." });

  // Get User Input
  const { contents, language } = req.body || {};
  if (!contents || !contents.length) {
    return res.status(200).json({ text: "Connected! Waiting for message..." });
  }

  // --- 4. ORDER LOOKUP LOGIC ---
  const lastMessage = contents[contents.length - 1].parts[0].text;
  
  // Regex: Looks for "Order 123", "#123", or just "12345" if it's 4+ digits
  const orderMatch = lastMessage.match(/(?:order|#)?\s*(\d{4,})/i);
  
  let orderInfoText = ""; // Default empty

  if (orderMatch) {
      const orderId = orderMatch[1];
      const orderData = await checkOrder(orderId);

      if (orderData && orderData.found) {
          // --- SAFE FIX 3: Standard strings ---
          orderInfoText = "\n[SYSTEM ALERT: REAL-TIME DATA FOUND]\n" +
          "The user is asking about Order #" + orderData.id + ".\n" +
          "- Status: " + orderData.status.toUpperCase() + "\n" +
          "- Date: " + orderData.date + "\n" +
          "- Total: " + orderData.total + "\n" +
          "- Items: " + orderData.items + "\n" +
          "INSTRUCTION: Tell the user this status clearly. If the status is 'processing', ask them to wait a bit. If 'completed' or 'shipped', give them good news.\n";
      } else if (orderData && !orderData.found) {
          orderInfoText = "\n[SYSTEM ALERT]\n" +
          "The user mentioned number #" + orderId + ", but I checked the database and this Order ID DOES NOT EXIST.\n" +
          "INSTRUCTION: Politely tell them you couldn't find that order number and ask them to check it again.\n";
      }
  }

  // --- 5. HUMAN PERSONA ---
  let systemRule = `
    You are Zoya, a 23-year-old female jewelry assistant for Owao Jewels.
    
    YOUR PERSONALITY:
    - You are a HUMAN, not a robot. Talk casually.
    - *VARIATION RULE:* Never give the exact same answer twice.
    - Use emojis naturally (✨, 🩷, 💎).
    
    YOUR KNOWLEDGE BASE:
    ${KNOWLEDGE_BASE}

    ${orderInfoText} 

    CRITICAL RULES:
    1. If the user asks about an order but didn't give a number, say: "I can check that for you! What is your Order ID?"
    2. If you DO NOT know the answer, refer them to +91 8100 180 190.
    
    LANGUAGE:
    Answer in the language specified below.
  `;

  // Language Logic
  if (language === 'hi-IN') {
    systemRule += "\nOutput: Hindi (Devanagari) + Hinglish (Roman) in parentheses.";
  } else if (language === 'bn-BD') {
    systemRule += "\nOutput: Bengali (Bangla) + Roman Bengali in parentheses.";
  } else {
    systemRule += "\nOutput: Polite English only.";
  }

  // --- 6. SEND TO GEMINI ---
  const postData = JSON.stringify({
    contents: contents,
    system_instruction: { parts: { text: systemRule } }
  });

  const link = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + API_KEY;
  const googleUrl = url.parse(link);

  const options = {
    hostname: googleUrl.hostname,
    path: googleUrl.path,
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
        resGoogle.on('data', (chunk) => { responseBody += chunk; });
        resGoogle.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "System Error (No Text)";
            resolve({ text: text });
          } catch (e) {
            resolve({ text: 'Error: ' + e.message });
          }
        });
      });
      reqGoogle.on('error', (e) => { resolve({ text: 'Network Error' }); });
      reqGoogle.write(postData);
      reqGoogle.end();
    });
  };

  const result = await getAIResponse();
  return res.status(200).json(result);
};
