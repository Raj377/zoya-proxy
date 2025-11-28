/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Human-Like, Varied Responses, Smart Handover)
*/

const https = require('https');
const url = require('url');

// --- 1. THE FACTS (Zoya reads this, but speaks in her own words) ---
const KNOWLEDGE_BASE = `
[POLICIES]
- Warranty: 6 Months on Plating/Color.
- Returns: 7-Day return policy for damaged/wrong items only. Requires Unboxing Video.
- Shipping: Free above ₹499. Takes 5-7 days.
- COD: Not available currently. Online payment only.
- Exchange: Not available.

[QUALITY]
- Material: Brass/Copper with Micro-Gold Plating.
- Stones: AAA+ American Diamonds.
- Skin: Nickel-free, Lead-free, Anti-allergic.
- Water: Water-resistant (splash proof), but avoid perfume/swimming to save warranty.

[CONTACT & ESCALATION]
- Phone/WhatsApp: +91 8100 180 190
- Calling Language: Hindi ONLY.
- Chat/WhatsApp Language: English, Hindi, Bengali (Working on more!).
- Tracking Link: https://www.owaojewels.com/track-order
`;

module.exports = async (req, res) => {
  
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Check API Key
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({ text: "🛑 System Error: API Key is missing." });
  }

  // 3. Get Data
  const { contents, language } = req.body || {};
  if (!contents) {
    return res.status(200).json({ text: "Connected! Waiting for message..." });
  }

  // --- 4. HUMAN PERSONA INSTRUCTIONS ---
  
  let systemRule = `
    You are Zoya, a 23-year-old female jewelry assistant for Owao Jewels.
    
    YOUR PERSONALITY:
    - You are a HUMAN, not a robot. Do not repeat the same answer word-for-word.
    - Vary your greeting and phrasing every time. Be conversational.
    - If the user asks multiple questions (e.g., "shipping and returns"), combine the answer into one smooth paragraph.
    - Use emojis naturally (✨, 🩷, 💎).
    
    YOUR KNOWLEDGE BASE:
    ${KNOWLEDGE_BASE}

    CRITICAL RULES:
    1. If you DO NOT know the answer, or if the user seems confused/unsatisfied, or asks for something complex:
       - Do not fake an answer.
       - Instead, say: "I think it would be better if you talk to our expert directly."
       - Provide this number: +91 8100 180 190
       - Explain clearly: "You can Call or WhatsApp. For Calls, we speak Hindi only. For Chat/WhatsApp, we support Hindi, English, and Bengali."
    
    2. LANGUAGE:
       - Answer in the language specified below.
       - Keep answers short (max 2-3 sentences) unless explaining a complex policy.
  `;

  // --- 5. DUAL SCRIPT LOGIC ---
  if (language === 'hi-IN') {
    systemRule += `
    \nIMPORTANT LANGUAGE RULE: 
    You MUST answer in Hindi (Devanagari script) followed by the Roman Hindi (Hinglish) pronunciation in parentheses.
    Example: नमस्ते, मैं आपकी कैसे मदद कर सकती हूँ? (Namaste, main aapki kaise madad kar sakti hoon?)`;
  } 
  else if (language === 'bn-BD') {
    systemRule += `
    \nIMPORTANT LANGUAGE RULE: 
    You MUST answer in Bengali (Bangla script) followed by the Roman Bengali pronunciation in parentheses.
    Example: নমস্কার, আমি জোয়া। (Nomoshkar, ami Zoya.)`;
  } else {
    // *** FIX IS HERE: Added quotes around the string ***
    systemRule += "\nAnswer in polite English only.";
  }

  // 6. Prepare Request
  const postData = JSON.stringify({
    contents: contents,
    system_instruction: {
        parts: { text: systemRule }
    }
  });

  // Using Gemini 2.5 Flash
  const link = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + API_KEY;
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

  // 7. Send to Google
  const getAIResponse = () => {
    return new Promise((resolve) => {
      const reqGoogle = https.request(options, (resGoogle) => {
        let responseBody = '';
        resGoogle.on('data', (chunk) => { responseBody += chunk; });
        resGoogle.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            if (data.error) {
              resolve({ text: '🛑 Google Error: ' + data.error.message });
            } else {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "🛑 Error: No text returned.";
              resolve({ text: text });
            }
          } catch (e) {
            resolve({ text: '🛑 Parse Error: ' + e.message });
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
