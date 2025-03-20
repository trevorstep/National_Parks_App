var esriConfig = {
  apiKey: API_KEY,
  nationalParksKey: NATIONAL_API_KEY
};

async function fetchParks() {
  const response = await fetch(
    `https://developer.nps.gov/api/v1/parks?limit=500&api_key=${esriConfig.nationalParksKey}`
  );

  const data = await response.json();
  return data.data;
}
