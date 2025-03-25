const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for all origins (or specify your front-end URL if you want to restrict access)
app.use(cors());

// Your API routes
app.get('/api/parks', (req, res) => {
  res.json({ message: "Parks data" });
});

// Your other routes...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

