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

function createPopupContent(attributes) {
  const container = document.createElement('div');
  container.className = 'popup-content';
  
  if (attributes.images && attributes.images.length > 0) {
    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'popup-images';
    
    attributes.images.slice(0, 3).forEach(img => {
      const imgElement = document.createElement('img');
      imgElement.src = img.url;
      imgElement.alt = img.altText || attributes.fullName;
      
      imgElement.onerror = function() {
        this.remove();
      };
      
      imagesDiv.appendChild(imgElement);
    });
    
    container.appendChild(imagesDiv);
  }
  
  const description = document.createElement('p');
  description.className = 'popup-description';
  description.textContent = attributes.description || "No description available";
  container.appendChild(description);
  
  const checkboxContainer = document.createElement('div');
  checkboxContainer.className = 'popup-checkbox-container';
  
  const label = document.createElement('label');
  label.className = 'checkbox-label';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'visited-checkbox';
  checkbox.checked = attributes.visited;
  checkbox.dataset.parkcode = attributes.parkCode;
  
  const span = document.createElement('span');
  span.textContent = "I've been here!";
  
  label.appendChild(checkbox);
  label.appendChild(span);
  checkboxContainer.appendChild(label);
  container.appendChild(checkboxContainer);
  
  return container;
}

function initializeMap() {
  require([
    'esri/Map',
    'esri/views/MapView',
    'esri/Graphic',
    'esri/layers/GraphicsLayer'
  ], function (Map, MapView, Graphic, GraphicsLayer) {

    const imageCache = new Map();

    function createCircularMarker(imageUrl, visited) {
      const cacheKey = `${imageUrl}_${visited}`;
      
      if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
      }

      return new Promise((resolve) => {
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
          
          ctx.strokeStyle = visited ? 'rgb(0, 0, 255)' : 'rgb(255, 0, 0)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(25, 25, 23, 0, Math.PI * 2);
          ctx.stroke();
          
          const dataUrl = canvas.toDataURL();
          imageCache.set(cacheKey, dataUrl);
          resolve(dataUrl);
        };
        img.onerror = function() {
          resolve(null);
        };
        img.src = imageUrl;
      });
    }

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
      },
      popup: {
        dockEnabled: true,
        dockOptions: {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-right"
        },
        alignment: "auto"
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

              const visitedKey = `park_visited_${park.parkCode}`;
              const visited = localStorage.getItem(visitedKey) === 'true';
              const parkImage = park.images && park.images.length > 0 ? park.images[0].url : null;
              
              let markerSymbol;
              
              if (parkImage) {
                createCircularMarker(parkImage, visited).then((dataUrl) => {
                  if (dataUrl) {
                    marker.symbol = {
                      type: 'picture-marker',
                      url: dataUrl,
                      width: '50px',
                      height: '50px'
                    };
                  }
                });
                
                markerSymbol = {
                  type: 'simple-marker',
                  color: visited ? [0, 0, 255] : [255, 0, 0],
                  size: '12px',
                  outline: {
                    color: [255, 255, 255],
                    width: 1
                  }
                };
              } else {
                const markerColor = visited ? [0, 0, 255] : [255, 0, 0];
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
                    return createPopupContent(feature.graphic.attributes);
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

      view.watch('zoom', (newZoom) => {
        const scale = Math.max(0.5, Math.min(1.5, newZoom / 6));
        graphicsLayer.graphics.forEach((graphic) => {
          if (graphic.symbol.type === 'picture-marker') {
            const currentUrl = graphic.symbol.url;
            graphic.symbol = {
              type: 'picture-marker',
              url: currentUrl,
              width: `${50 * scale}px`,
              height: `${50 * scale}px`
            };
          } else {
            const currentColor = graphic.symbol.color;
            graphic.symbol = {
              type: 'simple-marker',
              color: currentColor,
              size: `${12 * scale}px`,
              outline: {
                color: [255, 255, 255],
                width: 1
              }
            };
          }
        });
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
                    const visitedKey = `park_visited_${parkCode}`;

                    if (isChecked) {
                      localStorage.setItem(visitedKey, 'true');
                    } else {
                      localStorage.removeItem(visitedKey);
                    }
                    
                    graphic.attributes.visited = isChecked;

                    location.reload();
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