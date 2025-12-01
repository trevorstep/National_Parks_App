require("dotenv").config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(__dirname));

app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, 'main.html'));
});

app.get("/api/config", (request, response) => {
    response.json({
        arcgisApiKey: process.env.ARCGIS_API_KEY
    });
});

app.get("/national-parks", async (request, response) => {
    try {
        console.log("Fetching National Parks...");
        
        const res = await fetch(`https://developer.nps.gov/api/v1/parks?limit=500`, { 
            headers: { 'X-Api-Key': process.env.NATIONAL_API_KEY }
        });

        if (!res.ok) {
            console.error('NPS API request failed:', res.status, res.statusText);
            throw new Error('Failed to fetch parks data from NPS API');
        }

        const data = await res.json();
        
        if (!data.data) {
            console.error('No data field in response');
            throw new Error('Invalid response from NPS API');
        }
        
        const nationalParks = data.data
            .filter(park => park.designation === "National Park")
            .map(park => ({
                parkCode: park.parkCode,
                fullName: park.fullName,
                description: park.description,
                latLong: park.latLong,
                images: park.images ? park.images.slice(0, 6).map(img => ({
                    url: img.url,
                    altText: img.altText
                })) : []
            }));
        
        console.log(`Successfully processed ${nationalParks.length} National Parks`);
        response.json(nationalParks);
    } catch (error) {
        console.error('Error in /national-parks endpoint:', error.message);
        response.status(500).json({ 
            error: 'Failed to fetch parks data',
            message: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});