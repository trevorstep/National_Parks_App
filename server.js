require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.get('/api/parks', async (req, res) => {
  try {
    const apiKey = process.env.NATIONAL_API_KEY; // Get from .env or Render
    const response = await fetch(`https://developer.nps.gov/api/v1/parks?limit=500&api_key=${apiKey}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching parks data:', error);
    res.status(500).send('Error fetching parks data');
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
