/* FILE: api/chat.js
   PURPOSE: Connection Test (No AI)
*/

module.exports = async (req, res) => {
  // --- 1. OPEN THE DOORS (CORS) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // --- 2. HANDLE PREFLIGHT CHECKS ---
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 3. SEND SUCCESS SIGNAL ---
  // If the website can reach this file, it will send this text back.
  return res.status(200).json({ text: "Connection Successful! The wires are working." });
};
