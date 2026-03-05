import { initAuth, saveVisitedPark, removeVisitedPark, getVisitedParks } from './auth.js';
import esriConfig from "https://js.arcgis.com/4.32/@arcgis/core/config.js";
import Map from "https://js.arcgis.com/4.32/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.32/@arcgis/core/views/MapView.js";
import Graphic from "https://js.arcgis.com/4.32/@arcgis/core/Graphic.js";
import GraphicsLayer from "https://js.arcgis.com/4.32/@arcgis/core/layers/GraphicsLayer.js";

let visitedParksSet = new Set();
let isInitialLoad = true;
let viewRef = null;

// --- Main Application Startup ---
async function main() {
  showLoader();
  
  // Initialize all components
  initAuth();
  initializeModal();
  initializeMenuButton();
  initializeParkSearch();
  
  // Start loading the map (the longest async task)
  fetchConfigAndInitMap();
}

// --- Loader ---
function showLoader() {
  const loader = document.querySelector('.loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.querySelector('.loader');
  if (loader) loader.style.display = 'none';
}

// --- Progress Bar ---
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

// --- Auth Event Listeners ---
window.addEventListener('userLoggedIn', async () => {
  visitedParksSet = await getVisitedParks();
  updateProgressBar();
  if (window.mapInitialized) {
    updateAllMarkerColors();
  }
  isInitialLoad = false;
});

window.addEventListener('userLoggedOut', () => {
  visitedParksSet = new Set();
  updateProgressBar();
  if (window.mapInitialized) {
    updateAllMarkerColors();
  }
});

// --- Map and Data Fetching ---
function fetchConfigAndInitMap() {
    fetch('/api/config')
      .then(response => response.json())
      .then(config => {
        esriConfig.apiKey = config.arcgisApiKey;
        initializeMap();
      })
      .catch(error => {
        console.error('Error fetching API key:', error);
        hideLoader(); // Hide loader on error
      });
}

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

function initializeMap() {
    const map = new Map({ basemap: 'terrain' });

    const view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-98.5795, 39.8283],
      zoom: 4,
      constraints: { minZoom: 3, maxZoom: 16, rotationEnabled: false },
      popup: {
        dockEnabled: true,
        dockOptions: { buttonEnabled: false, breakpoint: false, position: "top-right" },
        alignment: "auto"
      }
    });
    viewRef = view;

    view.popup.actions = [];

    window.mapInitialized = true;

    view.when(async () => {
      const parks = await fetchParks();
      createParkMarkers(parks, Graphic, view, visitedParksSet);
      view.container.addEventListener('change', handleVisitedCheckboxChange);
      
      hideLoader();
    });
}

// --- Popup Content ---
function createPopupContent(feature) {
  const attributes = feature.graphic.attributes;
  const container = document.createElement('div');
  container.className = 'popup-content';

  // Images
  if (attributes.images && attributes.images.length > 0) {
    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'popup-images';
    attributes.images.slice(0, 3).forEach(img => {
      const imgElement = document.createElement('img');
      imgElement.src = img.localUrlLow || img.url;
      imgElement.alt = img.altText || attributes.fullName;
      imgElement.loading = 'lazy';
      imagesDiv.appendChild(imgElement);
    });
    container.appendChild(imagesDiv);
  }

  // Description
  const description = document.createElement('p');
  description.className = 'popup-description';
  description.textContent = attributes.description || "No description available";
  container.appendChild(description);

  // Visited Checkbox
  const checkboxContainer = document.createElement('div');
  checkboxContainer.className = 'popup-checkbox-container';
  const label = document.createElement('label');
  label.className = 'checkbox-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'visited-checkbox';
  checkbox.checked = visitedParksSet.has(attributes.parkCode);
  checkbox.dataset.parkcode = attributes.parkCode;
  const span = document.createElement('span');
  span.textContent = "I've been here!";
  label.appendChild(checkbox);
  label.appendChild(span);
  checkboxContainer.appendChild(label);
  container.appendChild(checkboxContainer);

  // Park Alerts
  const alertsContainer = document.createElement('div');
  alertsContainer.className = 'popup-alerts';
  container.appendChild(alertsContainer);
  // Intentionally call this without await to let it load in the background
  fetchParkAlerts(attributes.parkCode, alertsContainer); 

  return container;
}

async function fetchParkAlerts(parkCode, container) {
  try {
    const response = await fetch(`/park-alerts/${parkCode}`);
    const alerts = await response.json();
    
    if (!response.ok) {
        throw new Error(alerts.message || 'Failed to fetch alerts');
    }

    if (alerts && alerts.length > 0) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Park Alerts';
      details.appendChild(summary);

      alerts.slice(0, 3).forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-item';
        alertDiv.innerHTML = `
          <h4>${alert.title}</h4>
          <p>${alert.description}</p>
        `;
        details.appendChild(alertDiv);
      });
      container.appendChild(details);
    } else {
      container.innerHTML = '<p>No current alerts for this park.</p>';
    }
  } catch (error) {
    console.error(`Error fetching alerts for ${parkCode}:`, error);
    container.innerHTML = `<p class="error-text">Could not load park alerts.</p>`;
  }
}


// --- Park Markers ---
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
                attributes: { ...park, visited: visited },
                popupTemplate: {
                    title: "{fullName}",
                    content: createPopupContent
                }
            });
            graphicsLayer.add(marker);
        }
    });
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

function updateAllMarkerColors() {
    if (!graphicsLayerRef) return;
    graphicsLayerRef.graphics.forEach(graphic => {
        const visited = visitedParksSet.has(graphic.attributes.parkCode);
        if (graphic.attributes.visited !== visited) {
             updateMarkerColor(graphic.attributes.parkCode, visited);
        }
    });
}

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
        } catch (error) {
            console.error('Error updating park:', error);
            checkbox.checked = !isChecked;
            alert('Failed to update. Please try again.');
        } finally {
            checkbox.disabled = false;
        }
    }
}

// --- UI Components (Modal, Menu, Search) ---
function initializeModal() {
    const modal = document.querySelector('dialog');
    if (modal) {
        const modalImage = modal.querySelector('img');
        const closeButton = modal.querySelector('.close-viewer');
        const gallery = document.querySelector('.gallery');
        if (gallery) gallery.addEventListener('click', (e) => openModal(e, modal, modalImage));
        if (closeButton) closeButton.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.close();
        });
    }
}

function openModal(e, modal, modalImage) {
  if (e.target.tagName === 'IMG') {
    const src = e.target.getAttribute('src');
    const alt = e.target.getAttribute('alt');
    const full = src.replace('low', 'high');
    modalImage.src = full;
    modalImage.alt = alt;
    modal.showModal();
  }
}

function initializeMenuButton() {
    const btn = document.querySelector('.menu-btn');
    if (btn) btn.addEventListener('click', togglemenu);
}

function togglemenu() {
    const menu = document.querySelector('nav');
    const btn = document.querySelector('.menu-btn');
    if (menu) menu.classList.toggle('hide');
    if (btn) btn.classList.toggle('change');
}

function initializeParkSearch() {
    fetch("./data/nationalParks.json")
      .then(response => response.json())
      .then(data => {
        const container = document.querySelector('#parks-container');
        if (!container) return;
        const form = document.querySelector('form');
        const randomPark = data[Math.floor(Math.random() * data.length)];
        displayParks([randomPark], container);
        if (form) {
            form.addEventListener('submit', (e) => {
              e.preventDefault();
              const searchTerm = document.querySelector('#search').value.toLowerCase();
              const sorted = filterAndSortParks(data, searchTerm);
              displayParks(sorted, container);
            });
        }
      })
      .catch(err => console.error(err));
}

function displayParks(parks, container) {
    container.innerHTML = '';
    parks.forEach(park => container.innerHTML += parkTemplate(park));
}

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
        <p><strong>Activities:</strong> ${data.activities.map(a => a.name).slice(0, 3).join(", ")}</p>
        <p><strong>Topics:</strong> ${data.topics.map(t => t.name).slice(0, 3).join(", ")}</p>
      </div>
      <hr> 
    </div>
  `;
}

// --- Run Application ---
main();
