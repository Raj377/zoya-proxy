/* FILE: api/chat.js
   PURPOSE: Native Node.js (Zero Dependencies, Zero Fetch, Old School)
*/

const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  
  // --- 1. CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. SETUP ---
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({ text: "🛑 ERROR: API Key is missing in Vercel." });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ text: "Connected! Please send a POST message." });
  }

  const { contents } = req.body || {};
  if (!contents) {
    return res.status(200).json({ text: "🛑 ERROR: No message received." });
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

  // --- 4. SEND REQUEST (The Native Way) ---
  return new Promise((resolve, reject) => {
    const reqGoogle = https.request(options, (resGoogle) => {
      let responseBody = '';

      resGoogle.on('data', (chunk) => {
        responseBody += chunk;
      });

      resGoogle.on('end', () => {
        try {
          const data = JSON.parse(responseBody);
          
          if (data.error) {
            res.status(200).json({ text: 🛑 GOOGLE ERROR: ${data.error.message} });
          } else {
            const text = data.candidates[0].content.parts[0].text;
            res.status(200).json({ text: text });
          }
          resolve();
        } catch (e) {
          res.status(200).json({ text: 🛑 PARSE ERROR: ${e.message} });
          resolve();
        }
      });
    });

    reqGoogle.on('error', (e) => {
      res.status(200).json({ text: 🛑 NETWORK ERROR: ${e.message} });
      resolve();
    });

    // Write data to request body
    reqGoogle.write(postData);
    reqGoogle.end();
  });
};
