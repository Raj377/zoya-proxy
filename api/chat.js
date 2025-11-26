/* FILE: api/chat.js
   PURPOSE: Native Node.js AI (Fixed URL Syntax)
*/

const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  
  // --- 1. ALLOW CONNECTION (CORS) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle "Knock Knock"
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. CHECK SETTINGS ---
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({ text: "🛑 System Error: API Key is missing in Vercel." });
  }

  // If you click the link in browser (GET), say Hello
  if (req.method === 'GET') {
    return res.status(200).json({ text: "✅ AI Server is Online! (Send a POST to chat)" });
  }

  // --- 3. GET MESSAGE ---
  const { contents } = req.body || {};
  if (!contents) {
    return res.status(200).json({ text: "Connected! Waiting for message..." });
  }

  // --- 4. PREPARE GOOGLE REQUEST ---
  const postData = JSON.stringify({
    contents: contents,
    system_instruction: {
        parts: { text: "You are Zoya, the jewelry assistant for Owao Jewels. Answer shortly in English, Hindi, or Bengali." }
    }
  });

  // *** THE FIX IS HERE: Added backticks (`) around the URL ***
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

  // --- 5. SEND TO GOOGLE (Native Way) ---
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
              // Safety check if Google returns partial data
              const candidate = data.candidates && data.candidates[0];
              const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
              
              if (part && part.text) {
                  resolve({ text: part.text });
              } else {
                  resolve({ text: "🛑 Error: Google sent a blank response." });
              }
            }
          } catch (e) {
            resolve({ text: 🛑 Parse Error: ${e.message} - Body: ${responseBody} });
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
