import { initAuth } from './auth.js';
initAuth();

const main = document.getElementById('park-detail');
const id = Number(new URLSearchParams(window.location.search).get('id'));

function text(tag, className, value) { const node = document.createElement(tag); node.className = className; node.textContent = value || ''; return node; }

async function load() {
  const parks = await (await fetch('./data/nationalParks.json')).json();
  const park = parks.find(item => item.parkId === id);
  if (!park) { main.replaceChildren(text('h1', '', 'Park not found'), text('p', '', 'Use the map to choose one of the 64 tracked parks.')); return; }
  document.title = `${park.fullName} | National Parks Tracker`;
  main.replaceChildren();
  const hero = document.createElement('section'); hero.className = 'park-detail-hero';
  const image = document.createElement('img'); image.src = park.images?.[0]?.localUrlHigh || park.images?.[0]?.localUrlLow || park.images?.[0]?.url || ''; image.alt = park.images?.[0]?.altText || park.fullName;
  hero.appendChild(image);
  const heading = document.createElement('div'); heading.className = 'park-detail-heading'; heading.append(text('p', 'eyebrow', `Park ${park.parkId} · ${park.states}`), text('h1', '', park.fullName), text('p', 'lead', park.description));
  hero.appendChild(heading); main.appendChild(hero);
  const visit = document.createElement('label'); visit.className = 'detail-visited'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.disabled = true; visit.append(checkbox, document.createTextNode(" I've been here")); main.appendChild(visit);
  const overview = document.createElement('section'); overview.className = 'detail-grid';
  const activities = text('div', 'detail-card', ''); activities.append(text('h2', '', 'Things to do')); const list = document.createElement('ul'); (park.activities || []).slice(0, 12).forEach(item => list.appendChild(text('li', '', item))); activities.appendChild(list);
  const practical = text('div', 'detail-card', ''); practical.append(text('h2', '', 'Plan your visit'), text('p', '', park.directionsInfo || 'Visit the official NPS page for current directions and operating information.')); const nps = document.createElement('a'); nps.href = park.url; nps.target = '_blank'; nps.rel = 'noopener noreferrer'; nps.textContent = 'Official NPS site'; practical.appendChild(nps); overview.append(activities, practical); main.appendChild(overview);
  const future = document.createElement('section'); future.className = 'future-content'; future.append(text('h2', '', 'Hikes, campgrounds, and more'), text('p', '', 'This park page is ready for future trail, campground, and visitor-resource data.')); main.appendChild(future);
  if (park.images?.length > 1) { const gallery = document.createElement('section'); gallery.className = 'detail-gallery'; park.images.slice(1, 5).forEach(item => { const img = document.createElement('img'); img.src = item.localUrlLow || item.url; img.alt = item.altText || park.fullName; gallery.appendChild(img); }); main.appendChild(gallery); }
}
load().catch(() => main.replaceChildren(text('h1', '', 'Unable to load park details'), text('p', '', 'Please return to the map and try again.')));
