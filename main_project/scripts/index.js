require(["esri/config"], function(esriConfig){
  esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurOQRq8e4NVH7W0bSo5HVzi_Gd8F4qZZI9BfUl6IaHKnmhS4GyX7aabn85ZZ_U5y76dWxXy5INxIKvwutsmixxs1aWBC5YjdtjLnGKjT42oE5yyurClvdTuK-gacN4z4HqzwaunGLcxq_4Pv2VUSxm27tUoB1BQXOhiDiGE33w1VIVV1baLDvLktiR03nnf3nL0yFqwaDVIh7Hu1bX4LYjoU.AT1_i5yGOVLe"; 
});


async function fetchParks() {
  try {
    let parks = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await fetch(`/national-parks?page=${page}&limit=50`);
      if (!response.ok) throw new Error(`Failed to fetch parks on page ${page}`);

      const data = await response.json();
      if (data.data) {
        parks = parks.concat(data.data.filter(park => park.designation === 'National Park'));
      }

      totalPages = Math.ceil(data.total / 50); // Ensure all pages are fetched
      page++;
    }

    return parks;
  } catch (error) {
    console.error('Error fetching parks data:', error);
    return [];
  }
}


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
      // Check if the latLong property exists and is not empty
      if (park.latLong && park.latLong.trim() !== "") {
        // Parse the latLong string. Expected format: "lat:36.4864, long:-118.5658"
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

        // Only create a marker if both coordinates were successfully parsed
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
