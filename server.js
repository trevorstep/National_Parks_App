require("dotenv").config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "main_project")));

app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, 'main_project', 'index.html'));
});

app.get("/api/config", (request, response) => {
    response.json({
        arcgisApiKey: process.env.ARCGIS_API_KEY
    });
});

app.get("/national-parks", async (request, response) => {
    try {
        console.log("Fetching parks...");
        
        const fetchAllParks = async () => {
            let allParks = [];
            let start = 0;
            const limit = 50;
            let hasMore = true;
      
            while (hasMore) {
                console.log(`Fetching page starting at ${start}...`);
                const res = await fetch(`https://developer.nps.gov/api/v1/parks?start=${start}&limit=${limit}&fields=images`, { 
                    headers: { 'X-Api-Key': process.env.NATIONAL_API_KEY }
                });
      
                if (!res.ok) throw new Error('Failed to fetch parks data');
      
                const data = await res.json();
                console.log(`Received ${data.data.length} parks, total: ${data.total}`);
                
                // Log unique designations to see what we're getting
                const designations = [...new Set(data.data.map(p => p.designation))];
                console.log("Designations in this batch:", designations);
      
                if (data.data && data.data.length > 0) {
                    // Filter for National Parks
                    const nationalParks = data.data.filter(park => 
                        park.designation === "National Park"
                    );
                    console.log(`Found ${nationalParks.length} National Parks in this batch`);
                    allParks = allParks.concat(nationalParks);
                } else {
                    hasMore = false;
                }
      
                // Check if there are more results
                if (start + limit >= data.total) {
                    hasMore = false;
                }
                
                start += limit;
            }
            
            console.log(`Total National Parks found: ${allParks.length}`);
            return allParks;
        };
        
        const nationalParks = await fetchAllParks();
        response.json(nationalParks);
    } catch (error) {
        console.error('Error fetching parks data:', error);
        response.status(500).json({ error: 'Failed to fetch parks data' });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});