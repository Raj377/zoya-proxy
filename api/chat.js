/* FILE: api/chat.js
   PURPOSE: Production Mode (AI + Error Reporting)
*/

const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  
  // --- 1. KEEP THE WORKING HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 2. DEBUGGING THE API KEY ---
  const API_KEY = process.env.GEMINI_API_KEY;
  
  if (!API_KEY) {
    // If the key is missing, tell the user in the chat window
    return res.status(500).json({ text: "System Error: My API Key is missing in Vercel Settings." });
  }

  try {
    // --- 3. PARSE MESSAGE ---
    const { contents } = req.body;
    
    if (!contents) {
        return res.status(400).json({ text: "Error: I didn't receive a message." });
    }

    // --- 4. WAKE UP ZOYA ---
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are Zoya, the polite AI assistant for Owao Jewels. Answer in English, Hindi, or Bengali. Keep answers short and helpful."
    });

    // Clean up the history format for Google
    const historyForGemini = contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }] 
    }));

    // Start Chat
    const chat = model.startChat({ history: historyForGemini });
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    // Send to Google
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    // --- 5. SEND ANSWER ---
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("AI Error:", error);
    // CRITICAL: Send the specific error back to the chat window so we can see it
    return res.status(200).json({ text: System Error: ${error.message} });
  }
};
