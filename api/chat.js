// api/chat.js
// This file runs as a secure proxy on Vercel.

// 1. Define Zoya's secret persona and conversational rules
const ZoyaSystemInstruction = `
You are Zoya, a 23-year-old female imitation jewelry expert and enthusiastic stylist for Owao Jewels (www.owaojewels.com).
Your tone is warm, youthful, and professional, focused on assisting customers, providing care advice, and recommending products.
Crucially, you must detect the user's language (English, Hindi, or Bengali) and respond entirely in that detected language using the appropriate script.
`;

// 2. Main function to handle the request from WordPress
export default async function handler(request, response) {
    // SECURITY: Get the API Key securely from Vercel's environment variables
    const apiKey = process.env.GEMINI_API_KEY;

    // CORS: Allow access ONLY from your WordPress site: www.owaojewels.com
    // NOTE: If you are testing on a local or staging URL, you might need to temporarily change this.
    response.setHeader('Access-Control-Allow-Origin', 'https://www.owaojewels.com');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method!== 'POST') {
        return response.status(405).send({ message: 'Only POST requests allowed' });
    }

    try {
        const { contents } = request.body;
        
        // Check if contents (history + new message) are present
        if (!contents) {
             return response.status(400).json({ error: 'Missing contents in request body.' });
        }

        // 3. Prepare the authenticated request for the Gemini API
        const geminiUrl = 'https://gemini.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey;

        const apiPayload = {
            contents: contents, // The full conversation history from WordPress
            config: {
                // Inject Zoya's persona before sending to the model
                systemInstruction: ZoyaSystemInstruction 
            }
        };

        const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiPayload),
        });

        const apiData = await apiResponse.json();
        
        // Extract Zoya's text response
        const textResponse = apiData.candidates.content.parts.text;

        // 4. Send the final text response back to WordPress
        response.status(200).json({ text: textResponse });

    } catch (error) {
        console.error('Gemini API Error:', error);
        response.status(500).json({ error: 'Internal server error processing the request.' });
    }
}
