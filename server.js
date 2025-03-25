const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/parks', (req, res) => {
  res.json({ message: "Parks data" });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

