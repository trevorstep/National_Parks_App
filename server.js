const express = require('express');
const cors = require('cors');
const app = express();

// Allow requests from specific origin
const allowedOrigins = ['https://trevorstep.github.io']; // Update with your specific domains
const options = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(options));

app.get('/api/parks', (req, res) => {
  // Your logic to return park data
  res.json({ message: "Data about parks" });
});
