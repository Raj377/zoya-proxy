/* FILE: api/chat.js
   PURPOSE: Bulletproof Server (Prevents Crashing)
*/

module.exports = async (req, res) => {
  
  // --- 1. CORS HEADERS (Must happen first) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Preflight (Browser Check)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- 2. SAFE LIBRARY LOADING ---
    // We load the library INSIDE the function so the server doesn't crash on start
    let GoogleGenerativeAI;
    try {
      GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
    } catch (err) {
      throw new Error("Library Missing: package.json is not working.");
    }

    // --- 3. CHECK API KEY ---
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error("API Key Missing: Check Vercel Settings.");
    }

    // --- 4. CHECK MESSAGE ---
    const { contents } = req.body;
    if (!contents) {
      return res.status(400).json({ text: "Hello! I am awake, but you sent no message." });
    }

    // --- 5. RUN AI ---
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are Zoya, the jewelry assistant. Answer shortly."
    });

    // Fix history format
    const cleanHistory = contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }] 
    }));

    const chat = model.startChat({ history: cleanHistory });
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Crash Report:", error);
    // Return the error to the chat window
    return res.status(200).json({ text: ⚠ SYSTEM ERROR: ${error.message} });
  }
};
