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

async function getCoordinates(city) {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`;
  const geoData = await httpsGet(geoUrl);

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error("City not found");
  }

  return {
    latitude: geoData.results[0].latitude,
    longitude: geoData.results[0].longitude,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { endpoint, query, date } = req.query;
  const API_KEY = process.env.WEATHERSTACK_KEY;

  if (!endpoint || !query) {
    return res.status(400).json({ error: { info: "Missing endpoint or query" } });
  }

  try {

    // CURRENT → Weatherstack
    if (endpoint === "current") {
      const apiUrl = `https://api.weatherstack.com/current?access_key=${API_KEY}&query=${encodeURIComponent(query)}&units=m`;
      const data = await httpsGet(apiUrl);
      return res.status(200).json(data);
    }

    // HISTORICAL → Open-Meteo
    if (endpoint === "historical") {
      if (!date) {
        return res.status(400).json({ error: { info: "Missing date for historical" } });
      }

      const { latitude, longitude } = await getCoordinates(query);

      const histUrl =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
        `&start_date=${date}&end_date=${date}` +
        `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

      const data = await httpsGet(histUrl);

      return res.status(200).json({
        location: query,
        date: date,
        max_temp: data.daily.temperature_2m_max[0],
        min_temp: data.daily.temperature_2m_min[0],
      });
    }

    // MARINE → Open-Meteo
    if (endpoint === "marine") {
      const { latitude, longitude } = await getCoordinates(query);

      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}` +
        `&hourly=wave_height,wind_speed_10m&timezone=auto`;

      const data = await httpsGet(marineUrl);

      return res.status(200).json({
        location: query,
        wave_height: data.hourly.wave_height[0],
        wind_speed: data.hourly.wind_speed_10m[0],
      });
    }

    return res.status(400).json({ error: { info: "Invalid endpoint" } });

  } catch (e) {
    res.status(502).json({ error: { info: e.message } });
  }
};
