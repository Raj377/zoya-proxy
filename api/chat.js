/* FILE: api/chat.js
   PURPOSE: Sanity Check - Hello World
*/
module.exports = (req, res) => {
    return res.status(200).json({ text: "ALIVE: The server is working!" });
};
