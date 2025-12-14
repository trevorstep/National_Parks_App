import { initAuth, saveVisitedPark, removeVisitedPark, getVisitedParks } from './auth.js';

let visitedParksSet = new Set();
let isInitialLoad = true;
let graphicsLayerRef = null;

function updateProgressBar() {
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (!bar || !text) return;

  const totalParks = 63;
  const visitedCount = visitedParksSet.size;
  const percentage = Math.round((visitedCount / totalParks) * 100);

  bar.style.width = percentage + '%';
  text.innerHTML = `${visitedCount}/${totalParks} Parks (${percentage}%)`;
}

window.addEventListener('userLoggedIn', async () => {
  visitedParksSet = await getVisitedParks();
  updateProgressBar();

  // Reload map if already initialized (user logged in after page load)
  if (window.mapInitialized && !isInitialLoad) {
    location.reload();
  }
  isInitialLoad = false;
});

window.addEventListener('userLoggedOut', () => {
  visitedParksSet = new Set();
  updateProgressBar();
  if (window.mapInitialized) {
    location.reload();
  }
});

initAuth();

// Load API key and initialize map
fetch('/api/config')
  .then(response => response.json())
  .then(config => {
    require(["esri/config"], function (esriConfig) {
      esriConfig.apiKey = config.arcgisApiKey;
      initializeMap();
    });
  })
  .catch(error => console.error('Error fetching API key:', error));

async function fetchParks() {
  try {
    const response = await fetch('/national-parks');
    if (!response.ok) throw new Error('Failed to fetch parks data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching parks data:', error);
    return [];
  }
}

function createPopupContent(attributes) {
  const container = document.createElement('div');
  container.className = 'popup-content';

  // Images
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
      imgElement.onerror = () => {
        if (img.originalUrl) imgElement.src = img.originalUrl;
        else imgElement.remove();
      };
      imagesDiv.appendChild(imgElement);
    });

    container.appendChild(imagesDiv);

    if (hiddenImages.length > 0) {
      const hiddenDiv = document.createElement('div');
      hiddenDiv.className = 'popup-images-hidden';
      hiddenDiv.style.display = 'none';

      hiddenImages.forEach(img => {
        const imgElement = document.createElement('img');
        imgElement.src = img.localUrlLow || img.url;
        imgElement.alt = img.altText || attributes.fullName;
        imgElement.loading = 'lazy';
        imgElement.onerror = () => {
          if (img.originalUrl) imgElement.src = img.originalUrl;
          else imgElement.remove();
        };
        hiddenDiv.appendChild(imgElement);
      });

      const seeMoreBtn = document.createElement('button');
      seeMoreBtn.className = 'see-more-btn';
      seeMoreBtn.textContent = `See ${hiddenImages.length} more photo${hiddenImages.length > 1 ? 's' : ''}`;
      seeMoreBtn.onclick = () => {
        hiddenDiv.style.display = 'flex';
        seeMoreBtn.style.display = 'none';
      };

      container.appendChild(seeMoreBtn);
      container.appendChild(hiddenDiv);
    }
  }

  // Description
  const description = document.createElement('p');
  description.className = 'popup-description';
  description.textContent = attributes.description || "No description available";
  container.appendChild(description);

  // Checkbox
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

function updateMarkerColor(parkCode, visited) {
  if (!graphicsLayerRef) return;
  
  const graphic = graphicsLayerRef.graphics.find(g => g.attributes.parkCode === parkCode);
  if (graphic) {
    graphic.attributes.visited = visited;
    graphic.symbol = {
      type: 'simple-marker',
      color: visited ? [0, 0, 255] : [255, 0, 0],
      size: '14px',
      outline: { color: [255, 255, 255], width: 2 }
    };
  }
}

function initializeMap() {
  require([
    'esri/Map',
    'esri/views/MapView',
    'esri/Graphic',
    'esri/layers/GraphicsLayer',
    'esri/core/reactiveUtils'
  ], function (Map, MapView, Graphic, GraphicsLayer, reactiveUtils) {

    const map = new Map({ basemap: 'topo-vector' });

    const view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-98.5795, 39.8283],
      zoom: 4,
      constraints: { minZoom: 3, maxZoom: 18, rotationEnabled: false },
      popup: {
        dockEnabled: true,
        dockOptions: { buttonEnabled: false, breakpoint: false, position: "top-right" },
        alignment: "auto"
      }
    });

    window.mapInitialized = true;
    graphicsLayerRef = new GraphicsLayer();
    map.add(graphicsLayerRef);

    view.when(async () => {
      const parks = await fetchParks();
      if (!parks || !Array.isArray(parks)) return;

      parks.forEach((park) => {
        if (!park.latLong) return;

        const parts = park.latLong.split(",");
        let lat = null, lng = null;

        parts.forEach(part => {
          const trimmed = part.trim();
          if (trimmed.startsWith("lat:")) lat = parseFloat(trimmed.split("lat:")[1]);
          else if (trimmed.startsWith("long:")) lng = parseFloat(trimmed.split("long:")[1]);
        });

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          const visited = visitedParksSet.has(park.parkCode);

          const marker = new Graphic({
            geometry: { type: 'point', longitude: lng, latitude: lat },
            symbol: {
              type: 'simple-marker',
              color: visited ? [0, 0, 255] : [255, 0, 0],
              size: '14px',
              outline: { color: [255, 255, 255], width: 2 }
            },
            attributes: {
              parkCode: park.parkCode,
              fullName: park.fullName,
              description: park.description || "No description available",
              visited: visited,
              images: park.images || []
            },
            popupTemplate: {
              title: "{fullName}",
              content: (feature) => createPopupContent(feature.graphic.attributes)
            }
          });

          graphicsLayerRef.add(marker);
        }
      });

      // Watch for popup opening
      reactiveUtils.watch(
        () => view.popup.visible,
        (visible) => {
          if (visible) {
            setTimeout(attachCheckboxListener, 150);
          }
        }
      );
    });
  });
}

// FIXED: Better checkbox handling
function attachCheckboxListener() {
  const checkbox = document.querySelector('.visited-checkbox');
  if (!checkbox || checkbox.dataset.listenerAttached) return;

  checkbox.dataset.listenerAttached = 'true';
  
  checkbox.addEventListener('change', async function(e) {
    const parkCode = this.dataset.parkcode;
    const isChecked = this.checked;
    
    // Disable checkbox during save
    this.disabled = true;

    try {
      if (isChecked) {
        await saveVisitedPark(parkCode);
        visitedParksSet.add(parkCode);
      } else {
        await removeVisitedPark(parkCode);
        visitedParksSet.delete(parkCode);
      }

      updateProgressBar();
      updateMarkerColor(parkCode, isChecked);
      console.log(`Park ${parkCode} ${isChecked ? 'saved' : 'removed'}`);
    } catch (error) {
      console.error('Error updating park:', error);
      // Revert checkbox on error
      this.checked = !isChecked;
      alert('Failed to update. Please try again.');
    } finally {
      this.disabled = false;
    }
  });
}

// Search functionality
fetch("./data/nationalParks.json")
  .then(response => response.json())
  .then(data => {
    const parks_container = document.querySelector('#parks-container');
    const form = document.querySelector('form');

    // Show random park on load
    const randomPark = data[Math.floor(Math.random() * data.length)];
    parks_container.innerHTML = parkTemplate(randomPark);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const searchTerm = document.querySelector('#search').value.toLowerCase();

      const filtered = data.filter(park =>
        park.fullName.toLowerCase().includes(searchTerm) ||
        park.parkCode.toLowerCase().includes(searchTerm) ||
        park.description.toLowerCase().includes(searchTerm) ||
        park.activities.some(a => a.toLowerCase().includes(searchTerm)) ||
        park.topics.some(t => t.toLowerCase().includes(searchTerm)) ||
        park.states.toLowerCase().includes(searchTerm)
      );

      const sorted = filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
      
      parks_container.innerHTML = '';
      sorted.forEach(park => parks_container.innerHTML += parkTemplate(park));
    });
  })
  .catch(err => console.error(err));

function parkTemplate(data) {
  return `
    <div class="park-container">
      <picture>
        <source media="(min-width: 901px)" srcset="/images/parks/high/${data.parkCode}_0.jpg">
        <img class="park-img park-search-img" 
             src="/images/parks/low/${data.parkCode}_0.jpg"
             alt="${data.images?.[0]?.altText || data.fullName}">
      </picture>
      
      <div class="park-contents">
        <h2>${data.fullName}</h2>
        <div class="description">${data.description}</div>
        <p><strong>Activities:</strong> ${data.activities.slice(0, 3).join(", ")}</p>
        <p><strong>Topics:</strong> ${data.topics.slice(0, 3).join(", ")}</p>
      </div>
      <hr> 
    </div>
  `;
}