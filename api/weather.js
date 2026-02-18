const https = require("https");

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON from upstream")); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

module.exports = async (req, res) => {
  // CORS headers — allow any browser to call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { endpoint, query, date } = req.query;
  const API_KEY = process.env.WEATHERSTACK_KEY;

  if (!endpoint || !query) {
    return res.status(400).json({ error: { info: "Missing endpoint or query" } });
  }

  let apiUrl = `https://api.weatherstack.com/${endpoint}?access_key=${API_KEY}&query=${encodeURIComponent(query)}&units=m`;
  if (endpoint === "historical" && date) {
    apiUrl += `&historical_date=${date}&hourly=1&interval=3`;
  }

  try {
    const data = await httpsGet(apiUrl);
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: { info: e.message } });
  }
};
