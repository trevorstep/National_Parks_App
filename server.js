require("dotenv").config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static("main_project"))

app.get("/national-parks", async (request, response) => {
  try {
      console.log(process.env.NATIONAL_API_KEY);
      
      const res = await fetch('https://developer.nps.gov/api/v1/parks?fields=latLong,parkCode,fullName,designation', {
          headers: {
              'X-Api-Key': process.env.NATIONAL_API_KEY
          }
      });

      if (!res.ok) throw new Error('Failed to fetch parks data');

      const data = await res.json();
      console.log("Raw API response:", data); // Debugging

      const nationalParks = data.data.filter(park => park.designation === "National Park");
      console.log("Filtered Parks:", nationalParks); // Debugging

      response.json(nationalParks);
  } catch (error) {
      console.error('Error fetching parks data:', error);
      response.status(500).json({ error: 'Failed to fetch national parks' });
  }
});



app.listen(3000)



