/* FILE: api/chat.js
   PURPOSE: CORS-Fixed Proxy for Owao Jewels
*/

const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  
  // --- 1. STRICT CORS FIX (The Solution) ---
  // We explicitly handle the Origin to satisfy browser security
  const origin = req.headers.origin;
  
  // Allow your website specifically
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle the "Preflight" check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. CHECK API KEY ---
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is missing.");
    return res.status(500).json({ error: "Server Error: API Key Missing" });
  }

  // --- 3. ONLY ALLOW POST REQUESTS ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // --- 4. PARSE USER MESSAGE ---
    const { contents } = req.body;
    
    // Safety check: ensure contents exist
    if (!contents || !Array.isArray(contents)) {
       throw new Error("Invalid message history format");
    }

    // Zoya's Persona
    const systemInstruction = `
      You are Zoya, the AI jewelry assistant for Owao Jewels (www.owaojewels.com).
      YOUR TRAITS:
      - Tone: Warm, professional, polite.
      - Languages: English, Hindi, Bengali.
      - Expertise: Imitation jewelry, cubic zirconia, gold-plated, oxidised silver.
      KEY RULES:
      1. Keep answers SHORT (max 2-3 sentences).
      2. Refer to "Call us" or "Mail us" for support.
      3. Never mention being an AI model.
    `;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction
    });

    // Clean History
    const cleanHistory = contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }] 
    }));

    // Start Chat
    const chat = model.startChat({ history: cleanHistory });
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Gemini Error:", error);
    // Return the actual error message so we can debug it in the browser
    return res.status(500).json({ error: error.message });
  }
};
