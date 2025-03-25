const express = require('express');
const cors = require('cors');
const app = express();

// Allow requests from specific origin
const allowedOrigins = ['https://trevorstep.github.io/National_Parks_App/main_project/main.html']; // Update with your specific domains
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


