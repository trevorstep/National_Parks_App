fetch('/api/config')
  .then(response => response.json())
  .then(config => {
    require(["esri/config"], function(esriConfig){
      esriConfig.apiKey = config.arcgisApiKey;
    });

    initializeMap();
  })
  .catch(error => {
    console.error('Error fetching API key:', error);
  });

async function fetchParks() {
  try {
    const response = await fetch('/national-parks');
    if (!response.ok) throw new Error('Failed to fetch parks data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching parks data:', error);
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
      basemap: 'arcgis/topographic'
    });

    const view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-98.5795, 39.8283],
      zoom: 4
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    fetchParks().then((parks) => {
      if (!parks || !Array.isArray(parks)) return;
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

          if (lat !== null && lng !== null) {
            const point = {
              type: 'point',
              longitude: lng,
              latitude: lat
            };

            const visited = localStorage.getItem(park.parkCode) === 'true';
            const markerColor = visited ? 'blue' : 'green';

            const marker = new Graphic({
              geometry: point,
              symbol: {
                type: 'simple-marker',
                color: markerColor,
                size: '10px'
              },
              attributes: {
                parkCode: park.parkCode,
                fullName: park.fullName,
                description: park.description,
                visited: visited
              },
              popupTemplate: {
                title: park.fullName,
                content: `
                  <p>${park.description}</p>
                  <label>
                    <input type="checkbox" id="visited-${park.parkCode}" ${visited ? 'checked' : ''}>
                    I've been here!
                  </label>
                `
              }
            });

            graphicsLayer.add(marker);
          }
        }
      });
    });

    view.when(() => {
      view.on('click', (event) => {
        view.hitTest(event).then((response) => {
          const result = response.results.find(
            (res) => res.graphic && res.graphic.layer === graphicsLayer
          );

          if (result) {
            const marker = result.graphic;
            const parkCode = marker.attributes.parkCode;

            view.popup.open({
              location: marker.geometry,
              features: [marker]
            });

            const checkbox = document.getElementById(`visited-${parkCode}`);
            if (checkbox) {
              checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;

                if (isChecked) {
                  localStorage.setItem(parkCode, 'true');
                } else {
                  localStorage.removeItem(parkCode);
                }

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
}