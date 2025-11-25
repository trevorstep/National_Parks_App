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
      zoom: 4,
      constraints: {
        minZoom: 3,
        maxZoom: 18,
        rotationEnabled: false
      }
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
              const point = {
                type: 'point',
                longitude: lng,
                latitude: lat
              };

              const visited = localStorage.getItem(park.parkCode) === 'true';
              const parkImage = park.images && park.images.length > 0 ? park.images[0].url : null;
              
              let markerSymbol;
              
              if (parkImage) {
                const canvas = document.createElement('canvas');
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d');
                
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                  ctx.beginPath();
                  ctx.arc(25, 25, 25, 0, Math.PI * 2);
                  ctx.closePath();
                  ctx.clip();
                  ctx.drawImage(img, 0, 0, 50, 50);
                  
                  ctx.strokeStyle = visited ? 'rgb(0, 0, 255)' : 'rgb(0, 255, 0)';
                  ctx.lineWidth = 4;
                  ctx.beginPath();
                  ctx.arc(25, 25, 23, 0, Math.PI * 2);
                  ctx.stroke();
                  
                  marker.symbol = {
                    type: 'picture-marker',
                    url: canvas.toDataURL(),
                    width: '50px',
                    height: '50px'
                  };
                };
                img.src = parkImage;
                
                markerSymbol = {
                  type: 'simple-marker',
                  color: visited ? [0, 0, 255] : [0, 255, 0],
                  size: '12px',
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                };
              } else {
                const markerColor = visited ? [0, 0, 255] : [0, 255, 0];
                markerSymbol = {
                  type: 'simple-marker',
                  color: markerColor,
                  size: '12px',
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                };
              }

              const marker = new Graphic({
                geometry: point,
                symbol: markerSymbol,
                attributes: {
                  parkCode: park.parkCode,
                  fullName: park.fullName,
                  description: park.description || "No description available",
                  visited: visited,
                  images: park.images || []
                },
                popupTemplate: {
                  title: "{fullName}",
                  content: function(feature) {
                    const attrs = feature.graphic.attributes;
                    let imageHTML = '';
                    
                    if (attrs.images && attrs.images.length > 0) {
                      imageHTML = '<div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">';
                      attrs.images.slice(0, 3).forEach(img => {
                        imageHTML += `<img src="${img.url}" alt="${img.altText}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px; border: 2px solid #ddd;">`;
                      });
                      imageHTML += '</div>';
                    }
                    
                    return `
                      ${imageHTML}
                      <p>${attrs.description}</p>
                      <label>
                        <input type="checkbox" class="visited-checkbox" data-parkcode="${attrs.parkCode}" ${attrs.visited ? 'checked' : ''}>
                        I've been here!
                      </label>
                    `;
                  }
                }
              });

              graphicsLayer.add(marker);
              addedCount++;
            }
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

                    if (isChecked) {
                      localStorage.setItem(parkCode, 'true');
                    } else {
                      localStorage.removeItem(parkCode);
                    }

                    if (graphic.symbol.type === 'picture-marker') {
                      graphic.symbol = {
                        type: 'picture-marker',
                        url: graphic.symbol.url,
                        width: '50px',
                        height: '50px'
                      };
                    } else {
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
                    }
                    
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