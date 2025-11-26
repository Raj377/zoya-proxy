/* FILE: api/chat.js
   PURPOSE: Safe Mode Proxy for Owao Jewels (CommonJS Version)
*/

// We use 'require' so we must use 'module.exports'
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // --- 1. ENABLE CORS (Allow Owao Jewels to connect) ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle the "Preflight" check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // --- 2. CHECK API KEY ---
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is missing.");
    return res.status(500).json({ error: "Server Configuration Error: API Key Missing" });
  }

  // --- 3. ONLY ALLOW POST REQUESTS ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // --- 4. PARSE USER MESSAGE ---
    const { contents } = req.body;
    
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

    // Prepare history for Gemini
    // We map the incoming history to ensure it fits the Gemini format
    const cleanHistory = contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }] 
    }));

    // Start Chat
    const chat = model.startChat({
      history: cleanHistory
    });

    // Send the last message
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    // --- 5. SEND SUCCESS RESPONSE ---
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Gemini API Crash:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
