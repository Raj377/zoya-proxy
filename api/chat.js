/* FILE: api/chat.js
   PURPOSE: X-Ray Debug Mode (Forces errors to show in chat)
*/

// Try to load the library. If it fails, we catch it below.
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}

module.exports = async (req, res) => {
  // --- 1. CORS HEADERS (Keep these, they work!) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- 2. CHECK LIBRARY INSTALLATION ---
    if (!GoogleGenerativeAI) {
      throw new Error("The '@google/generative-ai' library is missing. Vercel didn't install it.");
    }

    // --- 3. CHECK API KEY ---
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error("My API Key is missing in Vercel Environment Variables.");
    }

    // --- 4. CHECK MESSAGE ---
    const { contents } = req.body;
    if (!contents) {
      throw new Error("I received an empty message from the website.");
    }

    // --- 5. RUN AI ---
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are Zoya, the jewelry assistant. Answer shortly."
    });

    const cleanHistory = contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }] 
    }));

    const chat = model.startChat({ history: cleanHistory });
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    // Success!
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("DEBUG ERROR:", error);
    // HERE IS THE TRICK: We send Status 200 even for errors, so your chat displays them!
    return res.status(200).json({ text: 🛑 FIX ME: ${error.message} });
  }
};
