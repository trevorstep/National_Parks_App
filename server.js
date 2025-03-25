// server.js
require('dotenv').config(); // Loads keys from .env

const express = require('express');
const fetch = require('node-fetch'); // For Node 18+ you might use the built-in fetch
const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint to fetch parks data using your private NPS API key
app.get('/api/parks', async (req, res) => {
  try {
    const response = await fetch(
      `https://developer.nps.gov/api/v1/parks?limit=500&api_key=${process.env.NATIONAL_API_KEY}`
    );
    if (!response.ok) {
      throw new Error('Error fetching parks data');
    }
    const data = await response.json();
    // Filter for only National Parks
    const parks = data.data.filter((park) => park.designation === 'National Park');
    res.json(parks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch parks data' });
  }
});

// Serve static files from the 'public' folder
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
