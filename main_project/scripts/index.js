fetch('/api/config')
  .then(response => response.json())
  .then(config => {
    require(["esri/config"], function(esriConfig){
      esriConfig.apiKey = config.arcgisApiKey;
      console.log("API key configured");
      
      initializeMap();
    });
  })
  .catch(error => {
    console.error('Error fetching API key:', error);
  });

async function fetchParks() {
  try {
    const response = await fetch('/national-parks');
    if (!response.ok) throw new Error('Failed to fetch parks data');
    const parks = await response.json();
    console.log(`Fetched ${parks.length} parks from server`);
    return parks;
  } catch (error) {
    console.error('Error fetching parks data:', error);
    return [];
  }
}

function initializeMap() {
  require([
    'esri/Map',
    'esri/views/MapView',
    'esri/Graphic',
    'esri/layers/GraphicsLayer'
  ], function (Map, MapView, Graphic, GraphicsLayer) {

    const map = new Map({
      basemap: 'topo-vector'  
    });

    const view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-98.5795, 39.8283],
      zoom: 4
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    view.when(() => {
      console.log("Map view is ready");
      
      fetchParks().then((parks) => {
        if (!parks || !Array.isArray(parks)) {
          console.error("No parks data received");
          return;
        }
        
        console.log(`Processing ${parks.length} parks...`);
        let addedCount = 0;
        
        parks.forEach((park) => {
          console.log(`Processing park: ${park.fullName}, latLong: ${park.latLong}`);
          
          if (park.latLong && park.latLong.trim() !== "") {
            const parts = park.latLong.split(",");
            let lat = null, lng = null;
            
            parts.forEach(part => {
              const trimmed = part.trim();
              if (trimmed.startsWith("lat:")) {
                lat = parseFloat(trimmed.split("lat:")[1]);
              } else if (trimmed.startsWith("long:")) {
                lng = parseFloat(trimmed.split("long:")[1]);
              }
            });

            if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
              console.log(`Adding marker for ${park.fullName} at [${lat}, ${lng}]`);
              
              const point = {
                type: 'point',
                longitude: lng,
                latitude: lat
              };

              const visited = localStorage.getItem(park.parkCode) === 'true';
              const markerColor = visited ? [0, 0, 255] : [0, 255, 0]; 

              const marker = new Graphic({
                geometry: point,
                symbol: {
                  type: 'simple-marker',
                  color: markerColor,
                  size: '12px',
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                },
                attributes: {
                  parkCode: park.parkCode,
                  fullName: park.fullName,
                  description: park.description || "No description available",
                  visited: visited
                },
                popupTemplate: {
                  title: "{fullName}",
                  content: `
                    <p>{description}</p>
                    <label>
                      <input type="checkbox" class="visited-checkbox" data-parkcode="{parkCode}" ${visited ? 'checked' : ''}>
                      I've been here!
                    </label>
                  `
                }
              });

              graphicsLayer.add(marker);
              addedCount++;
            } else {
              console.warn(`Invalid coordinates for ${park.fullName}: lat=${lat}, lng=${lng}`);
            }
          } else {
            console.warn(`No latLong data for ${park.fullName}`);
          }
        });
        
        console.log(`Successfully added ${addedCount} markers to the map`);
      });

      view.popup.on("trigger-action", (event) => {
        console.log("Popup action triggered");
      });

      view.on('click', (event) => {
        view.hitTest(event).then((response) => {
          if (response.results.length > 0) {
            const graphic = response.results[0].graphic;
            
            if (graphic && graphic.layer === graphicsLayer) {
              setTimeout(() => {
                const checkbox = document.querySelector('.visited-checkbox');
                if (checkbox && !checkbox.hasListener) {
                  checkbox.hasListener = true;
                  checkbox.addEventListener('change', (e) => {
                    const parkCode = graphic.attributes.parkCode;
                    const isChecked = e.target.checked;
                    
                    console.log(`Checkbox changed for ${parkCode}: ${isChecked}`);

                    if (isChecked) {
                      localStorage.setItem(parkCode, 'true');
                    } else {
                      localStorage.removeItem(parkCode);
                    }

                    const newColor = isChecked ? [0, 0, 255] : [0, 255, 0];
                    graphic.symbol = {
                      type: 'simple-marker',
                      color: newColor,
                      size: '12px',
                      outline: {
                        color: [255, 255, 255],
                        width: 1
                      }
                    };
                    
                    graphicsLayer.graphics = graphicsLayer.graphics;
                  });
                }
              }, 100);
            }
          }
        });
      });
    });
  });
}