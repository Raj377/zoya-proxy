/* FILE: api/chat.js
   PURPOSE: Universal Node.js Chat (No Config Required)
*/

module.exports = async (req, res) => {
  
  // --- 1. CORS HEADERS (The Door Opener) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle "Knock Knock" (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. ERROR CATCHER (Prevents "Network Error") ---
  try {
    
    // Check if user is sending data (POST)
    if (req.method !== 'POST') {
      return res.status(200).json({ text: "Connected! Please send a POST message." });
    }

    // Check API Key
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error("My API Key is missing in Vercel Settings.");
    }

    // Get User Message
    const { contents } = req.body;
    if (!contents) {
      throw new Error("I received an empty message.");
    }

    // --- 3. TALK TO GOOGLE (Direct Line) ---
    // We send the message directly to Google's API URL
    const googleUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY};
    
    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        system_instruction: {
            parts: { text: "You are Zoya, the jewelry assistant for Owao Jewels. Answer shortly in English, Hindi, or Bengali." }
        }
      })
    });

    const data = await response.json();

    // Check if Google is angry
    if (data.error) {
      throw new Error("Google Error: " + data.error.message);
    }

    // Success!
    const text = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error(error);
    // CRITICAL: We send Status 200 so the chat window displays the error text!
    return res.status(200).json({ text: 🛑 FIX ME: ${error.message} });
  }
};
