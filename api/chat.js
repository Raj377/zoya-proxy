/* FILE: api/chat.js
   PURPOSE: Direct API Mode (No Library Required)
*/

export const config = {
  runtime: 'edge', // Faster, lighter, and supports 'fetch' natively
};

export default async function handler(req) {
  
  // --- 1. CORS SETUP (Standard) ---
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
  }

  try {
    // --- 2. GET DATA ---
    const { contents } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
       throw new Error("API Key is missing in Vercel Settings.");
    }

    // --- 3. DIRECT CALL TO GOOGLE (The Fix) ---
    // We call the URL directly, so we don't need to install any library.
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

    // Check if Google sent an error
    if (data.error) {
      throw new Error(data.error.message);
    }

    // Extract the text
    const text = data.candidates[0].content.parts[0].text;

    // --- 4. SUCCESS RESPONSE ---
    return new Response(JSON.stringify({ text: text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    // Return the actual error to the chat window
    return new Response(JSON.stringify({ text: ⚠ ERROR: ${error.message} }), {
      status: 200, // We send 200 so the frontend displays the error message
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
