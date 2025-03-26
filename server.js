require("dotenv").config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static("main_project"))

app.get("/national-parks", async (request,response) => {
    try {
      console.log(process.env.NATIONAL_API_KEY)
      const res = await fetch('https://developer.nps.gov/api/v1/parks',{
        headers:{
          'X-Api-Key': process.env.NATIONAL_API_KEY
        }
      });
      console.log(res)
      if (!res.ok) throw new Error('Failed to fetch parks data');
       response.json(await res.json());
    } catch (error) {
      console.error('Error fetching parks data:', error);
    }
})



app.listen(3000)



