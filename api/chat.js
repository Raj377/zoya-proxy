/* FILE: api/chat.js
   PURPOSE: Sanity Check - Vercel Native Mode
*/
export default function handler(req, res) {
    return res.status(200).json({ 
        text: "ALIVE: The server is working! We can see this message." 
    });
}
