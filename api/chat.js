/* FILE: api/chat.js
   PURPOSE: Standard Node.js Mode (No Library + No Config Needed)
*/

module.exports = async (req, res) => {
  
  // --- 1. CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. CHECK METHOD & KEY ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ text: "⚠ System Error: API Key is missing in Vercel Settings." });
  }

  try {
    // --- 3. GET DATA ---
    const { contents } = req.body;
    
    if (!contents) {
        return res.status(200).json({ text: "Connected! Waiting for message..." });
    }

    // --- 4. DIRECT CALL TO GOOGLE (Using Standard Fetch) ---
    // This uses the built-in internet tool, no installation required.
    const response = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY},
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          system_instruction: {
            parts: { text: "You are Zoya, the jewelry assistant for Owao Jewels. Answer shortly in English, Hindi, or Bengali." }
          }
        })
      }
    );

    const data = await response.json();

    // Check for Google Errors
    if (data.error) {
        throw new Error(data.error.message);
    }

    // Extract Text
    const text = data.candidates[0].content.parts[0].text;

    // --- 5. SUCCESS ---
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Error:", error);
    return res.status(200).json({ text: ⚠ ERROR: ${error.message} });
  }
};
