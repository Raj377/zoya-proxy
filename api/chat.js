/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Strict Multi-Language with Dual Script)
*/

const https = require('https');
const url = require('url');

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

  // 3. Get User Data
  const { contents, language } = req.body || {};
  
  if (!contents) {
    return res.status(200).json({ text: "Connected! Waiting for message..." });
  }

  // --- 4. THE LANGUAGE BRAIN ---
  // We define specific rules for each language option
  let systemRule = "You are Zoya, a 23-year-old female jewelry assistant. Answer in polite English only. Keep it short.";

  if (language === 'hi-IN') {
    systemRule = `You are Zoya, a 23-year-old female jewelry assistant. 
    You must answer in Hindi (Devanagari script) followed by the Roman Hindi (Hinglish) pronunciation in parentheses.
    Example format: नमस्ते, मैं ज़ोया हूँ। (Namaste, main Zoya hoon.)
    Do not use Bengali or English text outside the parentheses.`;
  } 
  else if (language === 'bn-BD') {
    systemRule = `You are Zoya, a 23-year-old female jewelry assistant. 
    You must answer in Bengali (Bangla script) followed by the Roman Bengali pronunciation in parentheses.
    Example format: নমস্কার, আমি জোয়া। (Nomoshkar, ami Zoya.)
    Do not use Hindi or English text outside the parentheses.`;
  }

  // 5. Prepare Request
  const postData = JSON.stringify({
    contents: contents,
    system_instruction: {
        parts: { text: systemRule }
    }
  });

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

  // 6. Send to Google
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
