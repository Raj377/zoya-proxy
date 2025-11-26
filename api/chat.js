/* FILE: api/chat.js
   PURPOSE: Secure Proxy for Gemini API with CORS enabled for Owao Jewels
*/

const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  // --- 1. ENABLE CORS (The Fix for "Network Error") ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allows your website to connect
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle the "Preflight" check (Browser asks: "Can I connect?")
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // --- 2. CHECK API KEY ---
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Server Error: GEMINI_API_KEY is missing in Vercel Environment Variables." });
  }

  // --- 3. ONLY ALLOW POST REQUESTS ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // --- 4. PARSE USER MESSAGE ---
    const { contents } = req.body;
    
    // Define Zoya's Persona
    const systemInstruction = `
      You are Zoya, the AI jewelry assistant for Owao Jewels (www.owaojewels.com).
      
      YOUR TRAITS:
      - Tone: Warm, professional, polite, and helpful. Like a boutique shop assistant.
      - Languages: You speak fluent English, Hindi, and Bengali. Detect the user's language and reply in the same language.
      - Expertise: You know about imitation jewelry, cubic zirconia (CZ), gold-plated items, and oxidised silver.
      
      KEY RULES:
      1. Keep answers SHORT (max 2-3 sentences) unless asked for details. Chat bubbles are small.
      2. If asked about prices, say: "Please check the product page for the latest prices and discounts."
      3. If asked for support/orders, say: "Please use the 'Mail us' or 'Call us' buttons at the top of the page."
      4. Never mention you are an AI model by Google. You are Zoya from Owao Jewels.
    `;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction
    });

    // --- 5. GENERATE RESPONSE ---
    // We send the chat history to Gemini
    const chat = model.startChat({
      history: contents.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.parts
      }))
    });

    // Get the last message from the user
    const lastMessage = contents[contents.length - 1].parts[0].text;
    
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    // --- 6. SEND BACK TO WEBSITE ---
    return res.status(200).json({ text: text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "Failed to generate response." });
  }
}
