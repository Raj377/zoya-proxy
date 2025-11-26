/* FILE: api/chat.js
   PURPOSE: Anti-Crash Mode (Using Dynamic Imports)
*/

module.exports = async (req, res) => {
  
  // --- 1. CORS HEADERS (Set these FIRST) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle "Knock Knock" (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- 2. DYNAMIC LOAD (The Fix) ---
    // We use 'await import' so if it fails, we catch it gracefully without crashing the server
    let GoogleGenerativeAI;
    try {
      const module = await import("@google/generative-ai");
      GoogleGenerativeAI = module.GoogleGenerativeAI;
    } catch (importError) {
      throw new Error("LIBRARY ERROR: Vercel cannot find '@google/generative-ai'. Please check package.json.");
    }

    // --- 3. CHECK API KEY ---
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error("KEY ERROR: My API Key is missing in Vercel Settings.");
    }

    // --- 4. CHECK MESSAGE ---
    const { contents } = req.body;
    if (!contents) {
      // If we got here, the connection is working!
      return res.status(200).json({ text: "Connected! Waiting for your message..." });
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

    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Caught Error:", error);
    // Send the error to the chat window (Status 200 ensures the browser shows it)
    return res.status(200).json({ text: 🛑 DIAGNOSIS: ${error.message} });
  }
};
