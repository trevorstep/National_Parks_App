require("dotenv").config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, 'main_project')));

app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, 'main_project', 'main.html'));
});

app.get("/api/config", (request, response) => {
    response.json({
        arcgisApiKey: process.env.ARCGIS_API_KEY
    });
});

// Serve local parks data (fast!)
app.get("/national-parks", (request, response) => {
    try {
        const parksData = fs.readFileSync(
            path.join(__dirname, 'main_project', 'data', 'nationalParks.json'),
            'utf-8'
        );
        response.json(JSON.parse(parksData));
    } catch (error) {
        console.error('Error reading local parks data:', error);
        response.status(500).json({ 
            error: 'Failed to load parks data',
            message: error.message 
        });
    }
});

// New endpoint to fetch alerts for a specific park
app.get("/park-alerts/:parkCode", async (request, response) => {
    try {
        const { parkCode } = request.params;
        console.log(`Fetching alerts for park: ${parkCode}`);
        
        const res = await fetch(
            `https://developer.nps.gov/api/v1/alerts?parkCode=${parkCode}`, 
            { headers: { 'X-Api-Key': process.env.NATIONAL_API_KEY } }
        );

        if (!res.ok) {
            throw new Error('Failed to fetch alerts from NPS API');
        }

        const data = await res.json();
        response.json(data.data || []);
    } catch (error) {
        console.error('Error fetching park alerts:', error.message);
        response.status(500).json({ 
            error: 'Failed to fetch alerts',
            message: error.message 
        });
    }
});

// Optional: Endpoint to refresh the local data (run periodically)
app.post("/refresh-parks-data", async (request, response) => {
    try {
        console.log("Refreshing parks data from NPS API...");
        
        const res = await fetch(`https://developer.nps.gov/api/v1/parks?limit=500`, { 
            headers: { 'X-Api-Key': process.env.NATIONAL_API_KEY }
        });

        if (!res.ok) {
            throw new Error('Failed to fetch parks data from NPS API');
        }

        const data = await res.json();
        
        const nationalParks = data.data
            .filter(park => park.designation === "National Park")
            .map(park => ({
                parkCode: park.parkCode,
                fullName: park.fullName,
                description: park.description,
                latLong: park.latLong,
                states: park.states,
                url: park.url,
                weatherInfo: park.weatherInfo,
                directionsInfo: park.directionsInfo,
                images: park.images ? park.images.map(img => ({
                    url: img.url,
                    altText: img.altText,
                    title: img.title,
                    caption: img.caption
                })) : [],
                activities: park.activities ? park.activities.map(a => a.name) : [],
                topics: park.topics ? park.topics.map(t => t.name) : [],
                contacts: park.contacts,
                entranceFees: park.entranceFees,
                operatingHours: park.operatingHours
            }));
        
        const dataDir = path.join(__dirname, 'main_project', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(dataDir, 'nationalParks.json'),
            JSON.stringify(nationalParks, null, 2)
        );
        
        const metadata = {
            lastUpdated: new Date().toISOString(),
            totalParks: nationalParks.length
        };
        
        fs.writeFileSync(
            path.join(dataDir, 'metadata.json'),
            JSON.stringify(metadata, null, 2)
        );
        
        console.log(`Successfully refreshed ${nationalParks.length} parks`);
        response.json({ 
            success: true, 
            parksCount: nationalParks.length,
            lastUpdated: metadata.lastUpdated
        });
    } catch (error) {
        console.error('Error refreshing parks data:', error.message);
        response.status(500).json({ 
            error: 'Failed to refresh parks data',
            message: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});