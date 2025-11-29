import { auth, provider, signInWithPopup, onAuthStateChanged, signOut, db, doc, setDoc, deleteDoc, collection, getDocs } from './firebase-config.js';

let currentUser = null;

export function initAuth() {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      loginBtn.style.display = 'none';
      userInfo.style.display = 'flex';
      userName.textContent = user.displayName;
      
      window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { userId: user.uid } }));
    } else {
      currentUser = null;
      loginBtn.style.display = 'block';
      userInfo.style.display = 'none';
      
      window.dispatchEvent(new Event('userLoggedOut'));
    }
  });

  loginBtn.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to sign in. Please try again.');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  });
}

export async function saveVisitedPark(parkCode) {
  if (!currentUser) return;
  
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'visitedParks', parkCode), {
      visited: true,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error saving park:', error);
  }
}

export async function removeVisitedPark(parkCode) {
  if (!currentUser) return;
  
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'visitedParks', parkCode));
  } catch (error) {
    console.error('Error removing park:', error);
  }
}

export async function getVisitedParks() {
  if (!currentUser) return new Set();
  
  try {
    const querySnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'visitedParks'));
    const visitedParks = new Set();
    querySnapshot.forEach((doc) => {
      visitedParks.add(doc.id);
    });
    return visitedParks;
  } catch (error) {
    console.error('Error getting visited parks:', error);
    return new Set();
  }
}

export function getCurrentUser() {
  return currentUser;
}