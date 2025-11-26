/* FILE: api/chat.js
   PURPOSE: Native Node.js (Zero Dependencies, Zero Fetch, Indestructible)
*/

const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  
  // --- 1. SET CORS HEADERS (Allow Owao Jewels to connect) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Browser Checks
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- 2. BASIC CHECKS ---
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(200).json({ text: "🛑 System Error: API Key is missing in Vercel Settings." });
    }

    // If user sends no message (GET request), just say hello
    if (req.method !== 'POST' || !req.body) {
      return res.status(200).json({ text: "✅ Server is Online! Send a POST message to chat." });
    }

    const { contents } = req.body;
    if (!contents) {
      return res.status(200).json({ text: "🛑 Error: Message was empty." });
    }

    // --- 3. PREPARE DATA FOR GOOGLE ---
    const postData = JSON.stringify({
      contents: contents,
      system_instruction: {
          parts: { text: "You are Zoya, the jewelry assistant for Owao Jewels. Answer shortly in English, Hindi, or Bengali." }
      }
    });

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

    // --- 4. SEND REQUEST (Native HTTPS - No Library Needed) ---
    const makeRequest = () => {
      return new Promise((resolve, reject) => {
        const reqGoogle = https.request(options, (resGoogle) => {
          let responseBody = '';

          resGoogle.on('data', (chunk) => { responseBody += chunk; });

          resGoogle.on('end', () => {
            try {
              const data = JSON.parse(responseBody);
              if (data.error) {
                resolve({ text: 🛑 Google Error: ${data.error.message} });
              } else {
                resolve({ text: data.candidates[0].content.parts[0].text });
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

    // Wait for the answer
    const result = await makeRequest();
    return res.status(200).json(result);

  } catch (error) {
    return res.status(200).json({ text: 🛑 Crash Error: ${error.message} });
  }
};
