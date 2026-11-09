import { initAuth } from './auth.js';
import { auth, db, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, updateDoc, doc } from './firebase-config.js';

initAuth();
const MAX_TITLE = 120;
const MAX_TEXT = 12000;
let allEntries = [];
let filteredEntries = [];
let currentPage = 0;
let editingId = null;

const pageSize = () => window.matchMedia('(max-width: 700px)').matches ? 1 : 2;
const clean = (value, max) => String(value || '').trim().slice(0, max);
function splitDescription(description) {
  const lines = String(description || '').split('\n\n');
  return { title: lines[0] || 'Untitled memory', text: lines.slice(1).join('\n\n') || lines[0] || '' };
}

async function saveJournalEntry(parkCode, parkName, title, text) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in to save journal entries');
  const cleanTitle = clean(title, MAX_TITLE);
  const cleanText = clean(text, MAX_TEXT);
  if (!parkCode || !/^[a-z0-9]{4,5}$/.test(parkCode)) throw new Error('Choose a valid park');
  if (!cleanTitle || !cleanText) throw new Error('Title and journal entry are required');
  const entryData = { userId: user.uid, parkCode, parkName: clean(parkName, 160), description: `${cleanTitle}\n\n${cleanText}`, timestamp: Date.now(), updatedAt: Date.now() };
  if (editingId) await updateDoc(doc(db, 'journalEntries', editingId), entryData);
  else { entryData.createdAt = new Date(); await addDoc(collection(db, 'journalEntries'), entryData); }
}

async function getAllJournalEntries() {
  if (!auth.currentUser) return [];
  const snapshot = await getDocs(query(collection(db, 'journalEntries'), where('userId', '==', auth.currentUser.uid), orderBy('timestamp', 'desc')));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data(), createdAt: item.data().createdAt?.toDate?.() || new Date(item.data().timestamp || Date.now()) }));
}

function setStatus(message, className = 'no-entries') {
  const container = document.getElementById('entries-container');
  container.replaceChildren();
  const element = document.createElement('p');
  element.className = className;
  element.textContent = message;
  container.appendChild(element);
}

function displayEntries() {
  const container = document.getElementById('entries-container');
  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / size));
  currentPage = Math.min(currentPage, totalPages - 1);
  const visible = filteredEntries.slice(currentPage * size, (currentPage + 1) * size);
  container.replaceChildren();
  if (!visible.length) setStatus(allEntries.length ? 'No entries match your filters.' : 'No journal entries yet. Start writing about your park adventures!');
  visible.forEach(entry => {
    const parts = splitDescription(entry.description);
    const card = document.createElement('article');
    card.className = 'entry-card';
    const title = document.createElement('h3'); title.className = 'entry-title'; title.textContent = parts.title;
    const meta = document.createElement('div'); meta.className = 'entry-meta';
    const park = document.createElement('span'); park.className = 'park-name'; park.textContent = entry.parkName;
    const date = document.createElement('time'); date.className = 'entry-date'; date.dateTime = entry.createdAt.toISOString(); date.textContent = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(entry.createdAt);
    meta.append(park, date);
    const body = document.createElement('p'); body.className = 'entry-text'; body.textContent = parts.text;
    const actions = document.createElement('div'); actions.className = 'entry-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-btn'; edit.textContent = 'Edit'; edit.addEventListener('click', () => beginEdit(entry));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-btn'; remove.textContent = 'Delete';
    remove.addEventListener('click', async () => { if (!confirm('Are you sure you want to delete this entry?')) return; try { await deleteDoc(doc(db, 'journalEntries', entry.id)); await loadAllEntries(); } catch { setStatus('Could not delete that entry.', 'error'); } });
    actions.append(edit, remove); card.append(title, meta, body, actions); container.appendChild(card);
  });
  document.getElementById('journal-prev').disabled = currentPage === 0;
  document.getElementById('journal-next').disabled = currentPage >= totalPages - 1;
  document.getElementById('journal-page-indicator').textContent = filteredEntries.length ? `Page ${currentPage + 1} of ${totalPages}` : '';
}

function applyFilters() {
  const search = clean(document.getElementById('journal-search').value, 80).toLowerCase();
  const sort = document.getElementById('journal-sort').value;
  filteredEntries = allEntries.filter(entry => { const parts = splitDescription(entry.description); return [parts.title, parts.text, entry.parkName].some(value => String(value).toLowerCase().includes(search)); });
  filteredEntries.sort((a, b) => sort === 'alphabetical' ? a.parkName.localeCompare(b.parkName) || a.createdAt - b.createdAt : sort === 'reverse-chronological' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  currentPage = 0; displayEntries();
}

function beginEdit(entry) {
  const parts = splitDescription(entry.description);
  document.getElementById('park-select').value = entry.parkCode;
  document.getElementById('entry-title').value = parts.title;
  document.getElementById('entry-text').value = parts.text;
  editingId = entry.id;
  document.getElementById('submit-btn').textContent = 'Save Changes';
  document.getElementById('cancel-edit-btn').hidden = false;
  document.getElementById('journal-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  editingId = null; document.getElementById('journal-form').reset();
  document.getElementById('submit-btn').textContent = 'Save Entry';
  document.getElementById('cancel-edit-btn').hidden = true;
}

async function loadParksIntoDropdown() {
  const parks = await (await fetch('./data/nationalParks.json')).json();
  const select = document.getElementById('park-select'); select.replaceChildren(new Option('-- Choose a Park --', ''));
  parks.sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(park => { const option = new Option(park.fullName, park.parkCode); option.dataset.parkName = park.fullName; select.appendChild(option); });
}

async function loadAllEntries() { try { allEntries = await getAllJournalEntries(); applyFilters(); } catch (error) { console.error(error); setStatus('Failed to load entries. Please refresh the page.', 'error'); } }

window.addEventListener('userLoggedIn', async () => { try { await loadParksIntoDropdown(); await loadAllEntries(); } catch { setStatus('Could not load the park list.', 'error'); } });
window.addEventListener('userLoggedOut', () => { allEntries = []; filteredEntries = []; setStatus('Please sign in to view your entries.'); document.getElementById('park-select').replaceChildren(new Option('-- Choose a Park --', '')); });

document.getElementById('journal-form').addEventListener('submit', async event => {
  event.preventDefault(); const select = document.getElementById('park-select'); const button = document.getElementById('submit-btn'); button.disabled = true;
  try { await saveJournalEntry(select.value, select.selectedOptions[0]?.dataset.parkName, document.getElementById('entry-title').value, document.getElementById('entry-text').value); cancelEdit(); await loadAllEntries(); }
  catch (error) { alert(error.message); } finally { button.disabled = false; }
});
document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
document.getElementById('journal-search').addEventListener('input', applyFilters);
document.getElementById('journal-sort').addEventListener('change', applyFilters);
function turnPage(direction) {
  const book = document.getElementById('entries-container');
  const className = direction > 0 ? 'turn-forward' : 'turn-back';
  book.classList.remove('turn-forward', 'turn-back');
  void book.offsetWidth;
  book.classList.add(className);
  currentPage += direction;
  displayEntries();
  window.setTimeout(() => book.classList.remove(className), 520);
}
document.getElementById('journal-prev').addEventListener('click', () => turnPage(-1));
document.getElementById('journal-next').addEventListener('click', () => turnPage(1));

const journalBook = document.querySelector('.journal-book');
let swipeStartX = null;
let swipeStartY = null;
let wheelLockUntil = 0;

journalBook.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') return;
  swipeStartX = event.clientX;
  swipeStartY = event.clientY;
});

journalBook.addEventListener('pointerup', event => {
  if (swipeStartX === null || event.pointerType === 'mouse') return;
  const deltaX = event.clientX - swipeStartX;
  const deltaY = event.clientY - swipeStartY;
  swipeStartX = null;
  swipeStartY = null;
  if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  turnPage(deltaX < 0 ? 1 : -1);
});

journalBook.addEventListener('pointercancel', () => { swipeStartX = null; swipeStartY = null; });

journalBook.addEventListener('wheel', event => {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 20 || Date.now() < wheelLockUntil) return;
  event.preventDefault();
  wheelLockUntil = Date.now() + 550;
  turnPage(event.deltaX > 0 ? 1 : -1);
}, { passive: false });

window.addEventListener('resize', displayEntries);
