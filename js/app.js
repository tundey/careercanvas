// ==========================================
// 1. FIREBASE v12 IMPORTS & CONFIGURATION
// ==========================================
// Import our pre-configured engine instances
import { db, auth, provider } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp  
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ==========================================
// 2. DOM ELEMENT SELECTORS
// ==========================================
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const addAppBtn = document.getElementById('add-app-btn');
const formModal = document.getElementById('form-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const deleteAppBtn = document.getElementById('delete-app-btn');
const appForm = document.getElementById('app-form');

// --- ADD THIS LINE RIGHT HERE ---
const modalTitle = document.getElementById('modal-title');

// Form Input Fields
const formAppId = document.getElementById('form-app-id');
const formCompany = document.getElementById('form-company');
const formTitle = document.getElementById('form-title');
const formMinSalary = document.getElementById('form-min-salary');
const formMaxSalary = document.getElementById('form-max-salary');
const formRequestedSalary = document.getElementById('form-requested-salary');
const formStatus = document.getElementById('form-status');
const formLocation = document.getElementById('form-location');
const formCityName = document.getElementById('form-city-name');
const formUrl = document.getElementById('form-url');
const formNotes = document.getElementById('form-notes');
const formSource = document.getElementById('form-source');
const formLastContact = document.getElementById('form-last-contact');

// Kanban Column Map
const columns = {
  'Wishlist': document.getElementById('col-wishlist'),
  'Applied': document.getElementById('col-applied'),
  'Interviewing': document.getElementById('col-interviewing'),
  'Offered': document.getElementById('col-offered'),
  'Rejected': document.getElementById('col-rejected')
};

const counts = {
  'Wishlist': document.getElementById('count-wishlist'),
  'Applied': document.getElementById('count-applied'),
  'Interviewing': document.getElementById('count-interviewing'),
  'Offered': document.getElementById('count-offered'),
  'Rejected': document.getElementById('count-rejected')
};

// Application State Cache
let currentUser = null;
let unsubscribeSnapshot = null;
let allApplications = [];

// Live auto-formatting while typing
[formMinSalary, formMaxSalary, formRequestedSalary].forEach(input => {
  input.addEventListener('input', (e) => {
    // Save the cursor position to prevent jumping bugs
    const cursorPosition = e.target.selectionStart;
    const originalLength = e.target.value.length;
    
    e.target.value = formatCurrency(e.target.value);
    
    // Adjust cursor placement smoothly after injecting characters
    const newLength = e.target.value.length;
    e.target.setSelectionRange(cursorPosition + (newLength - originalLength), cursorPosition + (newLength - originalLength));
  });
});

// ==========================================
// 3. AUTHENTICATION WORKFLOW
// ==========================================
loginBtn.addEventListener('click', () => {
  signInWithPopup(auth, provider).catch(err => console.error("Login failed:", err));
});

logoutBtn.addEventListener('click', () => {
  signOut(auth).catch(err => console.error("Logout failed:", err));
});

// Handle user login/logout states
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    syncApplications();
  } else {
    currentUser = null;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    clearBoardUI();
  }
});

// ==========================================
// 4. FIRESTORE REAL-TIME SYNC
// ==========================================
function syncApplications() {
  if (!currentUser) return;

  const userAppsRef = collection(db, `users/${currentUser.uid}/applications`);
  const q = query(userAppsRef, orderBy('lastUpdated', 'desc'));

  // Live real-time stream listener (works instantly offline too)
  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    allApplications = [];
    snapshot.forEach((doc) => {
      allApplications.push({ id: doc.id, ...doc.data() });
    });
    renderBoard();
	attachCardEventListeners();
  }, (error) => {
    console.error("Firestore sync error:", error);
  });
}

// ==========================================
// 5. UI RENDERING LOGIC
// ==========================================
function renderBoard() {
  clearBoardUI();

  // Temporary structures to hold grouped cards HTML fragments
  const fragments = { Wishlist: '', Applied: '', Interviewing: '', Offered: '', Rejected: '' };
  const columnCounts = { Wishlist: 0, Applied: 0, Interviewing: 0, Offered: 0, Rejected: 0 };

  allApplications.forEach(app => {
    const colName = app.status || 'Wishlist';
    if (!fragments[colName] === undefined) return;

    columnCounts[colName]++;

    // Format Salary for Display
    let salaryText = 'No salary listed';
    if (app.minSalary || app.maxSalary) {
      const minStr = app.minSalary ? `$${Number(app.minSalary).toLocaleString()}` : '?';
      const maxStr = app.maxSalary ? `$${Number(app.maxSalary).toLocaleString()}` : '?';
      salaryText = `${minStr} - ${maxStr}`;
    }
	
// Calculate true calendar day roll-over (With Strict Validation Guard)
let dateBadgeHtml = '';

if (app.dateApplied && typeof app.dateApplied === 'string') {
  // 1. Clean up any trailing/leading spaces and validate it's a parseable date string
  const cleanDateStr = app.dateApplied.trim();
  const timestampMs = Date.parse(cleanDateStr);

  // If the string is corrupt or invalid, Date.parse returns NaN
  if (!isNaN(timestampMs)) {
    // 2. Safely parse out the components
	// 2. Safely parse out the indexed array components
	const appliedParts = cleanDateStr.split('-');
	const appliedCalendarDate = new Date(
	  parseInt(appliedParts[0], 10),     // Year (e.g., 2026)
	  parseInt(appliedParts[1], 10) - 1, // Month (0-indexed, e.g., 6 - 1 = 5 for June)
	  parseInt(appliedParts[2], 10)      // Day (e.g., 22)
	);

    // 3. Get the user's current local calendar date at absolute Midnight
    const today = new Date();
    const localTodayCalendarDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 4. Subtract baselines to get the calendar day delta
    const diffTime = localTodayCalendarDate - appliedCalendarDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays <= 0) {
      dateBadgeHtml = `<span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm">Today</span>`;
    } else {
      // If an application has been sitting for greater than 14 calendar days, highlight it amber
      const ageColorClass = diffDays > 14 ? 'text-amber-600 bg-amber-50 font-bold' : 'text-slate-400 bg-slate-50';
      dateBadgeHtml = `<span class="text-[10px] px-1.5 py-0.5 rounded-sm ${ageColorClass}">${diffDays}d ago</span>`;
    }
  } else {
    // Fallback if the string format itself is unparseable
    dateBadgeHtml = `<span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm">Today</span>`;
  }
} else {
  // Fallback if dateApplied is missing or null
  dateBadgeHtml = `<span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm">Today</span>`;
}
	
	
	// Generate HTML card string
	fragments[colName] += `
	  <div class="job-card bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-2 group relative" 
		   draggable="true" 
		   data-id="${app.id}">
		<div class="flex items-start justify-between gap-2">
		  <div>
			<h4 class="font-bold text-slate-900 group-hover:text-blue-600 transition leading-tight">${app.companyName}</h4>
			<p class="text-xs text-slate-500 font-medium">${app.jobTitle}</p>
		  </div>
		  <div class="flex flex-col items-end gap-1 shrink-0">
			<span class="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
			  app.location === 'Remote' ? 'bg-indigo-50 text-indigo-600' :
			  app.location === 'Hybrid' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'
			}">${app.location || 'Remote'}</span>
			
			${dateBadgeHtml}
		  </div>
		</div>
		
		<p class="text-xs font-semibold text-slate-600">${salaryText}</p>
		
		${app.notes ? `<p class="text-xs text-slate-400 line-clamp-2 italic border-t border-slate-50 pt-1.5">${app.notes}</p>` : ''}
		
		<div class="pt-2 flex justify-end">
		  <select class="status-cycle-select text-[11px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 font-medium text-slate-600 focus:outline-hidden cursor-pointer" data-id="${app.id}">
			<option value="Wishlist" ${colName === 'Wishlist' ? 'selected' : ''}>→ Wishlist</option>
			<option value="Applied" ${colName === 'Applied' ? 'selected' : ''}>→ Applied</option>
			<option value="Interviewing" ${colName === 'Interviewing' ? 'selected' : ''}>→ Interviewing</option>
			<option value="Offered" ${colName === 'Offered' ? 'selected' : ''}>→ Offered</option>
			<option value="Rejected" ${colName === 'Rejected' ? 'selected' : ''}>→ Rejected</option>
		  </select>
		</div>
	  </div>
	`;
  });

  // Inject cards and counts into columns
  Object.keys(columns).forEach(key => {
    columns[key].innerHTML = fragments[key] || `<p class="text-xs text-slate-400 text-center py-6 border-2 border-dashed border-slate-200/50 rounded-xl">Empty</p>`;
    counts[key].textContent = columnCounts[key];
  });

  attachCardEventListeners();
}

function clearBoardUI() {
  Object.keys(columns).forEach(key => {
    columns[key].innerHTML = '';
    counts[key].textContent = '0';
  });
}

// Global placeholder for the Firestore Import function 'doc' & 'updateDoc'
//import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

function attachCardEventListeners() {
  // 1. CARD INTERACTIONS (Clicking & Dragging)
  Object.keys(columns).forEach(key => {
    const columnContainer = columns[key];

    columnContainer.querySelectorAll('.job-card').forEach(card => {
      // Click event to open edit view modal
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-cycle-select')) return;
        openModal(card.dataset.id);
      });

      // Native Drag Start: attach the application ID to the transfer pipeline
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        // Slight opacity adjustment to show it's actively selected
        setTimeout(() => card.classList.add('opacity-40'), 0);
      });

      // Drag End cleanup
      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-40');
      });
    });

    // 2. INLINE DROPDOWN SELECT MENUS
    columnContainer.querySelectorAll('.status-cycle-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        updateApplicationStatus(e.target.dataset.id, e.target.value);
      });
    });

    // 3. COLUMN DRAG & DROP TARGET ZONES
    // Prevent default browser behavior to enable dropping elements
    columnContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Visual feedback: give the column a clean borders highlight while hovering over it
      columnContainer.parentElement.classList.add('border-blue-400', 'bg-blue-50/40');
    });

    // Remove column highlights when a card leaves the area
    columnContainer.addEventListener('dragleave', () => {
      columnContainer.parentElement.classList.remove('border-blue-400', 'bg-blue-50/40');
    });

    // Process the drop action
    columnContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      // Strip off the column highlight classes safely
      columnContainer.parentElement.classList.remove('border-blue-400', 'bg-blue-50/40');
      
      const appId = e.dataTransfer.getData('text/plain');
      const newStatus = key; // The column key name matches our statuses exactly

      if (appId) {
        updateApplicationStatus(appId, newStatus);
      }
    });
  });
}

// Reusable handler to push status changes back to Firestore
async function updateApplicationStatus(appId, newStatus) {
  if (!currentUser) return;
  const appRef = doc(db, `users/${currentUser.uid}/applications`, appId);
  try {
    await updateDoc(appRef, { 
      status: newStatus,
      lastUpdated: new Date().toISOString().slice(0, 10)
    });
  } catch (err) {
    console.error("Error updating application status:", err);
  }
}

// ==========================================
// 6. MODAL & INTERACTION HANDLERS
// ==========================================
function openModal(id = null) {
  appForm.reset();
  formAppId.value = '';
  modalTitle.textContent = 'Add New Application';
  deleteAppBtn.classList.add('hidden');

  if (id) {
    const app = allApplications.find(a => a.id === id);
    if (app) {
      formAppId.value = app.id;
      modalTitle.textContent = `Edit ${app.companyName}`;
      formCompany.value = app.companyName;
      formTitle.value = app.jobTitle;
	  formMinSalary.value = app.minSalary ? formatCurrency(app.minSalary) : '';
	  formMaxSalary.value = app.maxSalary ? formatCurrency(app.maxSalary) : '';
	  formRequestedSalary.value = app.requestedSalary ? formatCurrency(app.requestedSalary) : '';
      formStatus.value = app.status || 'Wishlist';
      formLocation.value = app.location || 'Remote';
	  formCityName.value = app.cityName || '';
      formUrl.value = app.url || '';
	  formSource.value = app.Source || '';
      formNotes.value = app.notes || '';
	  formLastContact.value = app.lastContact || '';
      deleteAppBtn.classList.remove('hidden');
    }
  }
  formModal.classList.remove('hidden');
}

function closeModal() {
  formModal.classList.add('hidden');
}

addAppBtn.addEventListener('click', () => openModal());
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

// ==========================================
// 7. FORM CRUD ACTION
// ==========================================
appForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const id = formAppId.value;
  // 1. GENERATE TIMESTAMP BASED ON YOUR LOCAL CALENDAR DATE (NOT UTC)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  //const timestamp = `${year}-${month}-${day}`; // Always outputs clean local "YYYY-MM-DD"
  const timestamp = new Date().toISOString();
  const formLastContact = document.getElementById('form-last-contact');
  
  debugger;

  const appData = {
    companyName: formCompany.value,
    jobTitle: formTitle.value,
    minSalary: parseCurrencyToNumber(formMinSalary.value),
    maxSalary: parseCurrencyToNumber(formMaxSalary.value),
    requestedSalary: parseCurrencyToNumber(formRequestedSalary.value), 
    status: formStatus.value,
    location: formLocation.value,
	cityName: formCityName.value,
    url: formUrl.value,
	source: formSource.value,
    notes: formNotes.value,
    lastUpdated: serverTimestamp(), 
	lastContact: formLastContact.value || ''
  };

  const collectionRef = collection(db, `users/${currentUser.uid}/applications`);

  try {
    if (id) {
      // Update Existing
      const docRef = doc(db, `users/${currentUser.uid}/applications`, id);
      await updateDoc(docRef, appData);
    } else {
      // Create New
      appData.dateApplied = timestamp;
      await addDoc(collectionRef, appData);
    }
    closeModal();
  } catch (err) {
    console.error("Error saving data: ", err);
  }
});

// Delete Record Action
deleteAppBtn.addEventListener('click', async () => {
  const id = formAppId.value;
  if (id && currentUser && confirm("Are you sure you want to remove this application?")) {
    try {
      const docRef = doc(db, `users/${currentUser.uid}/applications`, id);
      await deleteDoc(docRef);
      closeModal();
    } catch (err) {
      console.error("Error deleting data: ", err);
    }
  }
});

// ==========================================
// 8. REGISTER SERVICE WORKER FOR PWA CAPABILITY
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker successfully initialized inside scope:', reg.scope))
      .catch(err => console.error('Service worker initialization failure:', err));
  });
}

// Helper: Convert a raw number or numeric string to a clean currency format ($130,000)
function formatCurrency(value) {
  if (!value) return '';
  // Strip out any non-digit characters
  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) return '';
  // Format as standard US currency
  return '$' + Number(cleanValue).toLocaleString('en-US');
}

// Helper: Strip formatting characters back out into a raw integer for Firebase storage
function parseCurrencyToNumber(value) {
  if (!value) return null;
  const cleanValue = String(value).replace(/\D/g, '');
  return cleanValue ? Number(cleanValue) : null;
}