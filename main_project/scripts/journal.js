import { initAuth } from './auth.js';
import { auth, db, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from './firebase-config.js';

initAuth();

// Journal functions
async function saveJournalEntry(parkCode, parkName, description) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in to save journal entries');
  if (!description || description.trim() === '') throw new Error('Journal entry cannot be empty');

  const entryData = {
    userId: user.uid,
    parkCode: parkCode,
    parkName: parkName,
    description: description.trim(),
    createdAt: new Date(),
    timestamp: Date.now()
  };

  const docRef = await addDoc(collection(db, 'journalEntries'), entryData);
  console.log('Journal entry saved:', docRef.id);
  return docRef.id;
}

async function getAllJournalEntries() {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, 'journalEntries'),
    where('userId', '==', user.uid),
    orderBy('timestamp', 'desc')
  );

  const querySnapshot = await getDocs(q);
  const entries = [];

  querySnapshot.forEach((doc) => {
    entries.push({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(doc.data().timestamp)
    });
  });

  return entries;
}

async function deleteJournalEntry(entryId) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in to delete entries');
  await deleteDoc(doc(db, 'journalEntries', entryId));
  console.log('Entry deleted:', entryId);
}

function formatEntryDate(date) {
  const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

  return {
    date: date.toLocaleDateString('en-US', dateOptions),
    time: date.toLocaleTimeString('en-US', timeOptions),
    full: `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`
  };
}

let allEntries = [];

window.addEventListener('userLoggedIn', async () => {
  console.log('User logged in, loading entries...');
  await loadParksIntoDropdown();
  await loadAllEntries();
});

window.addEventListener('userLoggedOut', () => {
  console.log('User logged out');
  document.getElementById('entries-container').innerHTML = '<p>Please sign in to view your entries.</p>';
  document.getElementById('park-select').innerHTML = '<option value="">-- Choose a Park --</option>';
});

async function loadParksIntoDropdown() {
  try {
    // Try the API endpoint first
    let response = await fetch('/national-parks');
    
    // If that fails, try loading from the JSON file directly
    if (!response.ok) {
      console.log('API endpoint not available, loading from JSON file');
      response = await fetch('./data/NationalParks.json');
    }
    
    const parks = await response.json();
    
    const select = document.getElementById('park-select');
    select.innerHTML = '<option value="">-- Choose a Park --</option>';
    
    parks.sort((a, b) => a.fullName.localeCompare(b.fullName));
    
    parks.forEach(park => {
      const option = document.createElement('option');
      option.value = park.parkCode;
      option.textContent = park.fullName;
      option.dataset.parkName = park.fullName;
      select.appendChild(option);
    });
    
    console.log(`Loaded ${parks.length} parks into dropdown`);
  } catch (error) {
    console.error('Error loading parks:', error);
    alert('Failed to load parks list. Please refresh the page.');
  }
}

const form = document.getElementById('journal-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const parkSelect = document.getElementById('park-select');
  const parkCode = parkSelect.value;
  const parkName = parkSelect.selectedOptions[0].dataset.parkName;
  const title = document.getElementById('entry-title').value;
  const text = document.getElementById('entry-text').value;
  
  const description = `${title}\n\n${text}`;
  
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    await saveJournalEntry(parkCode, parkName, description);
    alert('Entry saved successfully!');
    form.reset();
    await loadAllEntries();
  } catch (error) {
    console.error('Error saving entry:', error);
    alert('Failed to save entry: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Entry';
  }
});

async function loadAllEntries() {
  const container = document.getElementById('entries-container');
  
  try {
    allEntries = await getAllJournalEntries();
    
    if (allEntries.length === 0) {
      container.innerHTML = '<p class="no-entries">No journal entries yet. Start writing about your park adventures!</p>';
      return;
    }
    
    displayEntries(allEntries);
  } catch (error) {
    console.error('Error loading entries:', error);
    container.innerHTML = '<p class="error">Failed to load entries. Please refresh the page.</p>';
  }
}

function displayEntries(entries) {
  const container = document.getElementById('entries-container');
  container.innerHTML = '';
  
  entries.forEach(entry => {
    const formatted = formatEntryDate(entry.createdAt);
    
    const lines = entry.description.split('\n\n');
    const title = lines[0];
    const text = lines.slice(1).join('\n\n') || lines[0];
    
    const entryCard = document.createElement('div');
    entryCard.className = 'entry-card';
    entryCard.innerHTML = `
      <div class="entry-header">
        <h3 class="entry-title">${title}</h3>
        <div class="entry-meta">
          <span class="park-name">${entry.parkName}</span>
          <span class="entry-date">${formatted.date}</span>
        </div>
      </div>
      <div class="entry-body">
        <p class="entry-text">${text}</p>
      </div>
      <div class="entry-actions">
        <button class="delete-btn" data-id="${entry.id}">Delete</button>
      </div>
    `;
    
    container.appendChild(entryCard);
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const entryId = e.target.dataset.id;
      if (confirm('Are you sure you want to delete this entry?')) {
        try {
          await deleteJournalEntry(entryId);
          await loadAllEntries();
        } catch (error) {
          alert('Failed to delete entry');
        }
      }
    });
  });
}