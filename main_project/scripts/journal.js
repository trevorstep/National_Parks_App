import { initAuth } from './auth.js';
import { 
  saveJournalEntry, 
  getAllJournalEntries, 
  deleteJournalEntry,
  formatEntryDate 
} from './journal.js';

initAuth();

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
    const response = await fetch('/national-parks');
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
    await loadAllEntries(); // Refresh entries
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
          await loadAllEntries(); // Refresh
        } catch (error) {
          alert('Failed to delete entry');
        }
      }
    });
  });
}