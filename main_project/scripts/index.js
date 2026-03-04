import { initAuth, saveVisitedPark, removeVisitedPark, getVisitedParks } from './auth.js';

// A Set to store the park codes of visited parks.
let visitedParksSet = new Set();
// A flag to check if it's the initial load of the page.
let isInitialLoad = true;
// A reference to the ArcGIS GraphicsLayer.
let graphicsLayerRef = null;

/**
 * Updates the progress bar and text to reflect the number of visited parks.
 */
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

/**
 * Event listener for when a user logs in.
 * It fetches the visited parks, updates the progress bar, and reloads the map.
 */
window.addEventListener('userLoggedIn', async () => {
  visitedParksSet = await getVisitedParks();
  updateProgressBar();

  if (window.mapInitialized && !isInitialLoad) {
    location.reload();
  }
  isInitialLoad = false;
});

/**
 * Event listener for when a user logs out.
 * It clears the visited parks, updates the progress bar, and reloads the map.
 */
window.addEventListener('userLoggedOut', () => {
  visitedParksSet = new Set();
  updateProgressBar();
  if (window.mapInitialized) {
    location.reload();
  }
});

// Initialize the authentication module.
initAuth();

/**
 * Fetches the ArcGIS API key from the server and then initializes the map.
 */
function fetchConfigAndInitMap() {
    fetch('/api/config')
      .then(response => response.json())
      .then(config => {
        require(["esri/config"], function (esriConfig) {
          esriConfig.apiKey = config.arcgisApiKey;
          initializeMap();
        });
      })
      .catch(error => console.error('Error fetching API key:', error));
}

fetchConfigAndInitMap();

/**
 * Fetches national parks data from the '/national-parks' endpoint.
 * @returns {Promise<Array>} A promise that resolves to an array of park objects.
 */
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

// Variables for the image modal gallery.
const gallery = document.querySelector('.gallery');
const modal = document.querySelector('dialog');
let modalImage, closeButton;

/**
 * Initializes the image modal functionality.
 */
function initializeModal() {
    if (modal) {
        modalImage = modal.querySelector('img');
        closeButton = modal.querySelector('.close-viewer');

        if (gallery) {
            gallery.addEventListener('click', openModal);
        }

        closeButton.addEventListener('click', () => {
            modal.close();
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.close();
            }
        });
    }
}

initializeModal();

/**
 * Opens the modal with the clicked image.
 * @param {Event} e The click event.
 */
function openModal(e) {
  if (e.target.tagName === 'IMG') {
    const img = e.target;
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt');
    const full = src.replace('low', 'high');

    modalImage.src = full;
    modalImage.alt = alt;
        
    modal.showModal();
  }
}

// Variables for the menu button.
const btn = document.querySelector('.menu-btn');
const menu = document.querySelector('nav');

/**
 * Adds event listener to the menu button.
 */
function initializeMenuButton() {
    if (btn) {
        btn.addEventListener('click', togglemenu);
    }
}

initializeMenuButton();


/**
 * Toggles the visibility of the navigation menu and changes the menu button's appearance.
 */
function togglemenu() {
    if (menu) {
      menu.classList.toggle('hide');
    }
    if (btn) {
      btn.classList.toggle('change');
    }
}

/**
 * Creates the HTML content for a map popup.
 * @param {object} attributes The attributes of the park graphic.
 * @returns {HTMLElement} The container element for the popup.
 */
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

/**
 * Updates the color of a map marker based on its visited status.
 * @param {string} parkCode The park code of the marker to update.
 * @param {boolean} visited Whether the park has been visited.
 */
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

/**
 * Creates and adds park markers to the graphics layer.
 * @param {Array} parks - Array of park data.
 * @param {esri/Graphic} Graphic - The ArcGIS Graphic class.
 * @param {esri/layers/GraphicsLayer} graphicsLayer - The layer to add graphics to.
 * @param {Set} visitedParksSet - A set of visited park codes.
 */
function createParkMarkers(parks, Graphic, graphicsLayer, visitedParksSet) {
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

            graphicsLayer.add(marker);
        }
    });
}

/**
 * Handles the change event for the 'visited' checkbox in the popup.
 * @param {Event} event The change event.
 */
async function handleVisitedCheckboxChange(event) {
    if (event.target.matches('.visited-checkbox')) {
        const checkbox = event.target;
        const parkCode = checkbox.dataset.parkcode;
        const isChecked = checkbox.checked;

        checkbox.disabled = true;

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
            checkbox.checked = !isChecked;
            alert('Failed to update. Please try again.');
        } finally {
            checkbox.disabled = false;
        }
    }
}

/**
 * Initializes the ArcGIS map and its components.
 */
function initializeMap() {
  require([
    'esri/Map',
    'esri/views/MapView',
    'esri/Graphic',
    'esri/layers/GraphicsLayer'
  ], function (Map, MapView, Graphic, GraphicsLayer) {

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
      createParkMarkers(parks, Graphic, graphicsLayerRef, visitedParksSet);
      view.container.addEventListener('change', handleVisitedCheckboxChange);
    });
  });
}

/**
 * Returns an HTML string for a park's display template.
 * @param {object} data The park data.
 * @returns {string} The HTML template string.
 */
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

/**
 * Filters and sorts the parks based on the search term.
 * @param {Array} data The array of park data.
 * @param {string} searchTerm The search term.
 * @returns {Array} The filtered and sorted array of parks.
 */
function filterAndSortParks(data, searchTerm) {
    const filtered = data.filter(park =>
        park.fullName.toLowerCase().includes(searchTerm) ||
        park.parkCode.toLowerCase().includes(searchTerm) ||
        park.description.toLowerCase().includes(searchTerm) ||
        park.activities.some(a => a.toLowerCase().includes(searchTerm)) ||
        park.topics.some(t => t.toLowerCase().includes(searchTerm)) ||
        park.states.toLowerCase().includes(searchTerm)
    );

    return filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Displays the parks in the container.
 * @param {Array} parks The array of parks to display.
 * @param {HTMLElement} container The container to display the parks in.
 */
function displayParks(parks, container) {
    container.innerHTML = '';
    parks.forEach(park => container.innerHTML += parkTemplate(park));
}

/**
 * Initializes the park search functionality.
 */
function initializeParkSearch() {
    fetch("./data/nationalParks.json")
      .then(response => response.json())
      .then(data => {
        const parks_container = document.querySelector('#parks-container');
        if (!parks_container) return;
        const form = document.querySelector('form');

        const randomPark = data[Math.floor(Math.random() * data.length)];
        parks_container.innerHTML = parkTemplate(randomPark);

        if (form) {
            form.addEventListener('submit', (e) => {
              e.preventDefault();
              const searchTerm = document.querySelector('#search').value.toLowerCase();
              const sorted = filterAndSortParks(data, searchTerm);
              displayParks(sorted, parks_container);
            });
        }
      })
      .catch(err => console.error(err));
}

initializeParkSearch();