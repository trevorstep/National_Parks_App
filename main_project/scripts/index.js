import { initAuth, saveVisitedPark, removeVisitedPark, getVisitedParks } from './auth.js';

let visitedParksSet = new Set();
let isInitialLoad = true;
let visitedParksLoaded = false;

function updateProgressBar() {
  const progressBar = document.getElementById('progress-bar');
  if (!progressBar) return;
  
  const totalParks = 63;
  const visitedCount = visitedParksSet.size;
  const percentage = Math.round((visitedCount / totalParks) * 100);
  
  progressBar.style.width = percentage + '%';
  progressBar.innerHTML = `${visitedCount}/${totalParks} Parks (${percentage}%)`;
}

window.addEventListener('userLoggedIn', async (e) => {
  console.log('userLoggedIn event fired, isInitialLoad:', isInitialLoad, 'mapInitialized:', window.mapInitialized);
  visitedParksSet = await getVisitedParks();
  visitedParksLoaded = true;
  console.log('Loaded visited parks:', visitedParksSet);
  
  updateProgressBar();
  
  window.dispatchEvent(new CustomEvent('visitedParksLoaded', { detail: { visitedParks: visitedParksSet } }));
  
  if (window.mapInitialized && !isInitialLoad) {
    console.log('RELOADING PAGE from userLoggedIn');
    location.reload();
  }
  isInitialLoad = false;
});

window.addEventListener('userLoggedOut', () => {
  console.log('userLoggedOut event fired');
  visitedParksSet = new Set();
  visitedParksLoaded = false;
  updateProgressBar();
  if (window.mapInitialized) {
    console.log('RELOADING PAGE from userLoggedOut');
    location.reload();
  }
});

initAuth();

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
    
    const visibleImages = attributes.images.slice(0, 3);
    const hiddenImages = attributes.images.slice(3);
    
    visibleImages.forEach(img => {
      const imgElement = document.createElement('img');
      imgElement.src = img.localUrlLow || img.url;
      imgElement.alt = img.altText || attributes.fullName;
      imgElement.loading = 'lazy';
      
      if (img.localUrlHigh) {
        imgElement.dataset.highRes = img.localUrlHigh;
      }
      
      imgElement.onerror = function() {
        if (img.originalUrl && this.src !== img.originalUrl) {
          console.log(`Local image failed, falling back to original: ${img.url}`);
          this.src = img.originalUrl || img.url;
        } else {
          this.remove();
        }
      };
      
      imagesDiv.appendChild(imgElement);
    });
    
    if (hiddenImages.length > 0) {
      const hiddenDiv = document.createElement('div');
      hiddenDiv.className = 'popup-images-hidden';
      hiddenDiv.style.display = 'none';
      
      hiddenImages.forEach(img => {
        const imgElement = document.createElement('img');
        imgElement.src = img.localUrlLow || img.url;
        imgElement.alt = img.altText || attributes.fullName;
        imgElement.loading = 'lazy';
        
        if (img.localUrlHigh) {
          imgElement.dataset.highRes = img.localUrlHigh;
        }
        
        imgElement.onerror = function() {
          if (img.originalUrl && this.src !== img.originalUrl) {
            this.src = img.originalUrl || img.url;
          } else {
            this.remove();
          }
        };
        
        hiddenDiv.appendChild(imgElement);
      });
      
      const seeMoreBtn = document.createElement('button');
      seeMoreBtn.className = 'see-more-btn';
      seeMoreBtn.textContent = `See ${hiddenImages.length} more photo${hiddenImages.length > 1 ? 's' : ''}`;
      seeMoreBtn.onclick = function() {
        hiddenDiv.style.display = 'flex';
        this.style.display = 'none';
      };
      
      container.appendChild(imagesDiv);
      container.appendChild(seeMoreBtn);
      container.appendChild(hiddenDiv);
    } else {
      container.appendChild(imagesDiv);
    }
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
    'esri/layers/GraphicsLayer',
    'esri/core/reactiveUtils'
  ], function (Map, MapView, Graphic, GraphicsLayer, reactiveUtils) {

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

    window.mapInitialized = true;

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    view.when(async () => {
      console.log("Map view is ready");
      
      if (window.userAuthInitialized && !visitedParksLoaded) {
        console.log("User is logged in, waiting for visited parks to load...");
        await new Promise(resolve => {
          window.addEventListener('visitedParksLoaded', (event) => {
            console.log("Visited parks loaded event received, set size:", event.detail.visitedParks.size);
            visitedParksSet = event.detail.visitedParks;
            updateProgressBar();
            resolve();
          }, { once: true });
        });
      } else if (visitedParksLoaded) {
        console.log("Visited parks already loaded, size:", visitedParksSet.size);
      } else {
        console.log("No user logged in, proceeding without visited parks");
      }
      
      console.log("Creating markers with visitedParksSet size:", visitedParksSet.size);
      
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
              const visited = visitedParksSet.has(park.parkCode);
              
              const markerColor = visited ? [0, 0, 255] : [255, 0, 0];
              const markerSymbol = {
                type: 'simple-marker',
                color: markerColor,
                size: '14px',
                outline: {
                  color: [255, 255, 255],
                  width: 2
                }
              };

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

      reactiveUtils.watch(
        () => view.zoom,
        (newZoom) => {
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
        }
      );

      view.on('click', (event) => {
        view.hitTest(event).then((response) => {
          if (response.results.length > 0) {
            const graphic = response.results[0].graphic;
            
            if (graphic && graphic.layer === graphicsLayer) {
              setTimeout(() => {
                const checkbox = document.querySelector('.visited-checkbox');
                if (checkbox && !checkbox.hasListener) {
                  checkbox.hasListener = true;
                  checkbox.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    const parkCode = graphic.attributes.parkCode;
                    const isChecked = checkbox.checked;

                    console.log(`Checkbox clicked: ${parkCode}, checked: ${isChecked}`);

                    try {
                      if (isChecked) {
                        await saveVisitedPark(parkCode);
                        visitedParksSet.add(parkCode);
                        updateProgressBar();
                        console.log('Saved to Firestore');
                      } else {
                        await removeVisitedPark(parkCode);
                        visitedParksSet.delete(parkCode);
                        updateProgressBar();
                        console.log('Removed from Firestore');
                      }
                      
                      graphic.attributes.visited = isChecked;

                      const newColor = isChecked ? [0, 0, 255] : [255, 0, 0];
                      graphic.symbol = {
                        type: 'simple-marker',
                        color: newColor,
                        size: '14px',
                        outline: {
                          color: [255, 255, 255],
                          width: 2
                        }
                      };
                      
                      console.log('Marker color updated successfully');
                    } catch (error) {
                      console.error('Error updating park:', error);
                    }
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