require("dotenv").config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static("main_project"))

app.get("/national-parks", async (request, response) => {
  try {
      console.log(process.env.NATIONAL_API_KEY);
      const res = await fetch('https://developer.nps.gov/api/v1/parks', {
          headers: {
              'X-Api-Key': process.env.NATIONAL_API_KEY
          }
      });

      const data = await res.json(); // Parse JSON

      // Filter only parks with designation "National Park"
      const nationalParks = data.data.filter(park => park.designation === "National Park");

      if (!res.ok) throw new Error('Failed to fetch parks data');
      response.json(nationalParks); // Send only National Parks to frontend
  } catch (error) {
      console.error('Error fetching parks data:', error);
  }
});




app.listen(3000)



