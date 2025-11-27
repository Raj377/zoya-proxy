/* FILE: api/chat.js
   PURPOSE: Zoya Backend (Native Node.js - Fixed Syntax)
*/

const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  
  // 1. Allow Connection (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle "Knock Knock"
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Check API Key
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({ text: "🛑 System Error: API Key is missing." });
  }

  // 3. Test Connection
  if (req.method === 'GET') {
    return res.status(200).json({ text: "✅ AI Server is Online! (Send a POST request)" });
  }

  // 4. Get Message
  const { contents } = req.body || {};
  if (!contents) {
    return res.status(200).json({ text: "Connected! Waiting for message..." });
  }

  // 5. Prepare Google Data
  const postData = JSON.stringify({
    contents: contents,
    system_instruction: {
        parts: { text: "You are Zoya, the jewelry assistant for Owao Jewels. Answer shortly in English, Hindi, or Bengali." }
    }
  });

  // *** FIX IS HERE: I added the backticks (`) around the URL ***
  const googleUrl = url.parse(https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY});

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
              resolve({ text: 🛑 Google Error: ${data.error.message} });
            } else {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "🛑 Error: No text returned.";
              resolve({ text: text });
            }
          } catch (e) {
            resolve({ text: 🛑 Parse Error: ${e.message} });
          }
        });
      });

      reqGoogle.on('error', (e) => {
        resolve({ text: 🛑 Network Error: ${e.message} });
      });

      reqGoogle.write(postData);
      reqGoogle.end();
    });
  };

  const result = await getAIResponse();
  return res.status(200).json(result);
};
