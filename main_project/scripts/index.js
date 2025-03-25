// Load API keys from keys.json
async function loadKeys() { 
  try {
    const response = await fetch('scripts/keys.json');
    if (!response.ok) throw new Error('Failed to load keys.json');
    return await response.json();
  } catch (error) {
    console.error('Error loading API keys:', error);
  }
}

loadKeys().then((keys) => {
  if (!keys) return;
  const { API_KEY, NATIONAL_API_KEY } = keys;

  console.log('API Key Loaded:', API_KEY);

  // Fetch National Parks from the NPS API
  async function fetchParks() {
    try {
      const response = await fetch(
        `https://developer.nps.gov/api/v1/parks?limit=500&api_key=${NATIONAL_API_KEY}`
      );
      if (!response.ok) throw new Error('Failed to fetch parks data');
      const data = await response.json();

      // Filter for National Parks only
      return data.data.filter((park) => park.designation === 'National Park');
    } catch (error) {
      console.error('Error fetching parks data:', error);
    }
  }

  // Load the Esri modules and create the map
  require([
    'esri/Map',
    'esri/views/MapView',
    'esri/Graphic',
    'esri/layers/GraphicsLayer',
  ], function (Map, MapView, Graphic, GraphicsLayer) {
    // Create the map
    const map = new Map({
      basemap: 'arcgis/topographic',
    });

    // Create the map view
    const view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-98.5795, 39.8283], // Center of the USA
      zoom: 4,
    });

    // Add a graphics layer to the map for markers
    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    // Fetch parks and create markers for each
    fetchParks().then((parks) => {
      if (!parks) return;
      parks.forEach((park) => {
        if (park.latitude && park.longitude) {
          const point = {
            type: 'point',
            longitude: park.longitude,
            latitude: park.latitude,
          };

          // Check if park is marked as visited in local storage
          const visited = localStorage.getItem(park.parkCode) === 'true';
          const markerColor = visited ? 'blue' : 'green';

          // Create a marker for each park
          const marker = new Graphic({
            geometry: point,
            symbol: {
              type: 'simple-marker',
              color: markerColor,
              size: '10px',
            },
            attributes: {
              parkCode: park.parkCode,
              fullName: park.fullName,
              description: park.description,
              visited: visited, // Store visited status
            },
            popupTemplate: {
              title: park.fullName,
              content: `
                <p>${park.description}</p>
                <label>
                  <input type="checkbox" id="visited-${park.parkCode}" ${visited ? 'checked' : ''}>
                  I've been here!
                </label>
              `,
            },
          });

          // Add the marker to the graphics layer
          graphicsLayer.add(marker);
        }
      });
    });

    // Listen for popup open and handle the checkbox
    view.when(() => {
      view.on('click', (event) => {
        view.hitTest(event).then((response) => {
          const result = response.results.find(
            (res) => res.graphic && res.graphic.layer === graphicsLayer
          );

          if (result) {
            const marker = result.graphic;
            const parkCode = marker.attributes.parkCode;

            // Open the popup with the updated content
            view.popup.open({
              location: marker.geometry,
              features: [marker],
            });

            // Add the checkbox change listener after popup is opened
            const checkbox = document.getElementById(`visited-${parkCode}`);
            if (checkbox) {
              checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;

                // Update local storage with the new visited status
                if (isChecked) {
                  localStorage.setItem(parkCode, 'true');
                } else {
                  localStorage.removeItem(parkCode);
                }

                // Update the marker color immediately
                marker.symbol.color = isChecked ? 'blue' : 'green';
                graphicsLayer.graphics.forEach((g) => {
                  if (g.attributes.parkCode === parkCode) {
                    g.symbol.color = isChecked ? 'blue' : 'green';
                  }
                });
              });
            }
          }
        });
      });
    });
  });
});