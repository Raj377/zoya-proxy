/* FILE: api/chat.js
   PURPOSE: Vercel Edge Function (Fast, Built-in Fetch, No Crash)
*/

export const config = {
  runtime: 'edge', // <--- This forces the modern system
};

export default async function handler(req) {
  
  // --- 1. CORS HEADERS ---
  // We allow everyone (*) to talk to Zoya
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle "Knock Knock" (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- 2. GET DATA ---
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ text: "Please use POST method." }), { status: 200, headers: corsHeaders });
    }

    const { contents } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
       throw new Error("System Error: API Key is missing in Vercel Settings.");
    }

    // --- 3. DIRECT CALL TO GOOGLE ---
    const googleResponse = await fetch(
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

    const data = await googleResponse.json();

    // Check if Google sent an error (like Invalid Key)
    if (data.error) {
      throw new Error(Google says: ${data.error.message});
    }

    // Success!
    const text = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ text: text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // --- 4. ERROR REPORTER ---
    // We send Status 200 (OK) even if it fails, so the Chat Window SHOWS the error text!
    return new Response(JSON.stringify({ text: 🛑 FIX ME: ${error.message} }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
