require("dotenv").config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static("main_project"));

app.get("/national-parks", async (request, response) => {
    try {
        console.log(process.env.NATIONAL_API_KEY);
        
        const fetchAllParks = async () => {
            let allParks = [];
            let page = 1;
            let totalPages = 1; 

            while (page <= totalPages) {
                const res = await fetch(`https://developer.nps.gov/api/v1/parks?page=${page}`, {
                    headers: {
                        'X-Api-Key': process.env.NATIONAL_API_KEY
                    }
                });

                if (!res.ok) throw new Error('Failed to fetch parks data');

                const data = await res.json();

                allParks = allParks.concat(data.data.filter(park => park.designation === "National Park"));

                totalPages = data.totalPages;
                page++;
            }

            return allParks;
        };

        const nationalParks = await fetchAllParks();
        response.json(nationalParks);
    } catch (error) {
        console.error('Error fetching parks data:', error);
    }
});

app.listen(3000);




