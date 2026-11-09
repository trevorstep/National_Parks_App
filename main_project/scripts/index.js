import { initAuth, saveVisitedPark, removeVisitedPark, getVisitedParks } from './auth.js';
import esriConfig from "https://js.arcgis.com/4.32/@arcgis/core/config.js";
import Map from "https://js.arcgis.com/4.32/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.32/@arcgis/core/views/MapView.js";
import Graphic from "https://js.arcgis.com/4.32/@arcgis/core/Graphic.js";
import GraphicsLayer from "https://js.arcgis.com/4.32/@arcgis/core/layers/GraphicsLayer.js";
import * as webMercatorUtils from "https://js.arcgis.com/4.32/@arcgis/core/geometry/support/webMercatorUtils.js";

// Basemap: swap this one value to try another style, e.g. 'gray-vector' or 'light-gray-vector'
const BASEMAP = 'topo-vector';
// How far from a marker (in px) a touch can land and still select it
const TAP_RADIUS_PX = 30;

let visitedParksSet = new Set();
let viewRef = null;
let graphicsLayerRef = null;

// --- Main Application Startup ---
async function main() {
  showLoader();
  
  // Initialize all components
  initAuth();
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

  const totalParks = 64;
  const visitedCount = visitedParksSet.size;
  const percentage = Math.round((visitedCount / totalParks) * 100);

  bar.style.width = percentage + '%';
  text.textContent = `${visitedCount}/${totalParks} Parks (${percentage}%)`;
}

// --- Auth Event Listeners ---
window.addEventListener('userLoggedIn', async () => {
  visitedParksSet = await getVisitedParks();
  updateProgressBar();
  if (window.mapInitialized) {
    updateAllMarkerColors();
  }
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
    const map = new Map({ basemap: BASEMAP });
    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);
    graphicsLayerRef = graphicsLayer;

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
      createParkMarkers(parks, graphicsLayer, visitedParksSet);
      if (window.matchMedia('(pointer: coarse)').matches) {
        enableLargeTapTargets(view, graphicsLayer);
      }
      view.container.addEventListener('change', handleVisitedCheckboxChange);
      
      hideLoader();
    });
}

// --- Mobile tap targets ---
// On touch screens a tap selects the nearest marker within TAP_RADIUS_PX,
// instead of requiring a direct hit on the 14px dot. Desktop is unchanged.
function enableLargeTapTargets(view, graphicsLayer) {
  view.popupEnabled = false; // popups are opened manually below

  view.on('click', (event) => {
    let nearest = null;
    let nearestLocation = null;
    let nearestDistance = TAP_RADIUS_PX;

    graphicsLayer.graphics.forEach((graphic) => {
      const location = webMercatorUtils.geographicToWebMercator(graphic.geometry);
      const screenPoint = view.toScreen(location);
      const distance = Math.hypot(screenPoint.x - event.x, screenPoint.y - event.y);
      if (distance <= nearestDistance) {
        nearest = graphic;
        nearestLocation = location;
        nearestDistance = distance;
      }
    });

    if (nearest) {
      view.openPopup({ features: [nearest], location: nearestLocation });
    } else {
      view.closePopup();
    }
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

  const detailLink = document.createElement('a');
  detailLink.className = 'popup-detail-link';
  detailLink.href = `park.html?id=${encodeURIComponent(attributes.parkId)}`;
  detailLink.textContent = 'Explore this park';
  container.appendChild(detailLink);

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
        const alertTitle = document.createElement('h4');
        alertTitle.textContent = alert.title;
        const alertText = document.createElement('p');
        alertText.textContent = alert.description;
        alertDiv.append(alertTitle, alertText);
        details.appendChild(alertDiv);
      });
      container.appendChild(details);
    } else {
      container.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'No current alerts for this park.' }));
    }
  } catch (error) {
    console.error(`Error fetching alerts for ${parkCode}:`, error);
    const errorText = document.createElement('p');
    errorText.className = 'error-text';
    errorText.textContent = 'Could not load park alerts.';
    container.replaceChildren(errorText);
  }
}


// --- Park Markers ---
function createParkMarkers(parks, graphicsLayer, visitedParksSet) {
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
        const sourceGraphic = graphicsLayerRef?.graphics.find(g => g.attributes.parkCode === parkCode);
        const relatedCodes = sourceGraphic && graphicsLayerRef.graphics
          .filter(g => g.attributes.latLong === sourceGraphic.attributes.latLong)
          .map(g => g.attributes.parkCode);
        const codesToUpdate = relatedCodes?.length > 1 ? relatedCodes : [parkCode];
        for (const code of codesToUpdate) {
          if (isChecked) {
            await saveVisitedPark(code);
            visitedParksSet.add(code);
          } else {
            await removeVisitedPark(code);
            visitedParksSet.delete(code);
          }
        }
            updateProgressBar();
            codesToUpdate.forEach(code => updateMarkerColor(code, isChecked));
        } catch (error) {
            console.error('Error updating park:', error);
            checkbox.checked = !isChecked;
            alert('Failed to update. Please try again.');
        } finally {
            checkbox.disabled = false;
        }
    }
}

// --- UI Components (Search) ---
function initializeParkSearch() {
    fetch("./data/nationalParks.json")
      .then(response => response.json())
      .then(data => {
        const container = document.querySelector('#parks-container');
        if (!container) return;
        const form = document.querySelector('form');
        displayParks(selectFiveParks(data), container);
        if (form) {
            form.addEventListener('submit', (e) => {
              e.preventDefault();
              const searchTerm = document.querySelector('#search').value.toLowerCase();
              const sorted = filterAndSortParks(data, searchTerm);
              displayParks(sorted.slice(0, 5), container);
              focusPark(sorted[0]);
            });
        }
      })
      .catch(err => console.error(err));
}

function selectFiveParks(data) {
  return [...data].sort(() => Math.random() - 0.5).slice(0, 5);
}

function focusPark(park) {
  if (!park || !viewRef || !graphicsLayerRef) return;
  const graphic = graphicsLayerRef.graphics.find(item => item.attributes.parkCode === park.parkCode);
  if (!graphic) return;
  viewRef.goTo({ target: graphic.geometry, zoom: Math.max(viewRef.zoom, 7) }, { duration: 700 })
    .then(() => viewRef.openPopup({ features: [graphic], location: graphic.geometry }))
    .catch(() => {});
}

function displayParks(parks, container) {
    container.replaceChildren(...parks.map(parkTemplate));
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

function escapeHTML(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, ch => map[ch]);
}

function parkTemplate(data) {
  const link = document.createElement('a');
  link.className = 'park-container';
  link.href = `park.html?id=${encodeURIComponent(data.parkId)}`;
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.media = '(min-width: 901px)';
  source.srcset = data.images?.[0]?.localUrlHigh || data.images?.[0]?.url || '';
  const image = document.createElement('img');
  image.className = 'park-img park-search-img';
  image.src = data.images?.[0]?.localUrlLow || data.images?.[0]?.url || '';
  image.alt = data.images?.[0]?.altText || data.fullName;
  image.loading = 'lazy';
  picture.append(source, image);
  const contents = document.createElement('div');
  contents.className = 'park-contents';
  const title = document.createElement('h2'); title.textContent = data.fullName;
  const description = document.createElement('div'); description.className = 'description'; description.textContent = data.description || 'No description available.';
  contents.append(title, description);
  link.append(picture, contents);
  return link;
}

// --- Run Application ---
main();
