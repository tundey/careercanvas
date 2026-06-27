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
  serverTimestamp,
  where
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
const formDateApplied = document.getElementById('form-dateApplied');
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
const formTag = document.getElementById('form-tag');
const formLastContact = document.getElementById('form-last-contact');

// Kanban Column Map
const columns = {
  'PreApplication': document.getElementById('col-preapplication'),
  'Applied': document.getElementById('col-applied'),
  'Interviewing': document.getElementById('col-interviewing'),
  'Offered': document.getElementById('col-offered'),
  'Rejected': document.getElementById('col-rejected')
};

const counts = {
  'PreApplication': document.getElementById('count-preapplication'),
  'Applied': document.getElementById('count-applied'),
  'Interviewing': document.getElementById('count-interviewing'),
  'Offered': document.getElementById('count-offered'),
  'Rejected': document.getElementById('count-rejected')
};

// Application State Cache
let currentUser = null;
let unsubscribeSnapshot = null;

// ==========================================
// 3. AUTHENTICATION WORKFLOW
// ==========================================
loginBtn.addEventListener('click', () => {
  signInWithPopup(auth, provider).catch(err => console.error("Login failed:", err));
});

//logoutBtn.addEventListener('click', () => {
//  signOut(auth).catch(err => console.error("Logout failed:", err));
//});

// Helper function to calculate a clean date string (30 days ago) matching YYYY-MM-DD
function getPastDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

// --- Dynamic Auth and Synchronizer System Wire Hook ---
onAuthStateChanged(auth, (user) => {
  if (user) {

    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');	

  } else {
    // Clear state structures on safe user logouts
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
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
// ==========================================
// 5. UI RENDERING LOGIC
// ==========================================
function renderBoard() {
  clearBoardUI();

  // Temporary structures to hold grouped cards HTML fragments
  const fragments = { PreApplication: '', Applied: '', Interviewing: '', Offered: '', Rejected: '' };
  const columnCounts = { PreApplication: 0, Applied: 0, Interviewing: 0, Offered: 0, Rejected: 0 };

  allApplications.forEach(app => {
    const colName = app.status || 'PreApplication';
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
	const appliedCalendarDate = new Date(cleanDateStr);

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
		
		${app.tag ? `
          <div class="pt-0.5">
            <span class="text-[10px] uppercase font-bold border px-2 py-0.5 rounded-md tracking-wider ${app.tag}">
              🏷️ ${app.tag}
            </span>
          </div>		
		 ` : ''}
		
		<div class="pt-2 flex justify-end">
		  <select class="status-cycle-select text-[11px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 font-medium text-slate-600 focus:outline-hidden cursor-pointer" data-id="${app.id}">
			<option value="PreApplication" ${colName === 'PreApplication' ? 'selected' : ''}>→ PreApplication</option>
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
      modalTitle.textContent = `Edit ${app.companyName}; ${app.dateApplied}`;
      formCompany.value = app.companyName;
      formTitle.value = app.jobTitle;
	  formMinSalary.value = app.minSalary ? formatCurrency(app.minSalary) : '';
	  formMaxSalary.value = app.maxSalary ? formatCurrency(app.maxSalary) : '';
	  formRequestedSalary.value = app.requestedSalary ? formatCurrency(app.requestedSalary) : '';
      formStatus.value = app.status || 'PreApplication';
      formLocation.value = app.location || 'Remote';
	  formCityName.value = app.cityName || '';
	  formSource.value = app.source || '';
	  formTag.value = app.tag || '';
      formNotes.value = app.notes || '';
      deleteAppBtn.classList.remove('hidden');

	  const tempLastContact = app.lastContact || '';
	  if (tempLastContact != ''){
		  formLastContact.value = new Date(app.lastContact).toISOString().split('T')[0];
	  }
	  
	  const tempDateApplied = app.dateApplied || '';
	  if (tempDateApplied != ''){
		  formDateApplied.value = new Date(app.dateApplied).toISOString().split('T')[0];
	  }
	  
    }
  }
  formModal.classList.remove('hidden');
}

function closeModal() {
  formModal.classList.add('hidden');
}


// ==========================================
// 7. FORM CRUD ACTION
// ==========================================

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

/**
 * Filters the master raw applications cache based on the selected calendar cutoff date,
 * populating the global allApplications array by evaluating formal JavaScript Date objects.
 */
function applyDateFilter() {
  const dateInput = document.getElementById('filter-start-date');

  if (!dateInput || !dateInput.value) return;

  // 1. Parse the calendar selector input string into a local Date object
  // Adding 'T00:00:00' locks it to local time rather than defaulting to UTC midnight
  const cutoffDate = new Date(dateInput.value + 'T00:00:00');
  cutoffDate.setHours(0, 0, 0, 0); // Clear out timestamps for uniform comparison

  allApplications = rawApplicationsCache.filter(app => {
    if (!app.dateApplied || app.dateApplied.trim() === '') return false;

    // 2. Convert the individual application's string date into a formal Date object
    const applicationDate = new Date(app.dateApplied);
    applicationDate.setHours(0, 0, 0, 0); // Clear out timestamps here as well
	
    // 3. Compare the absolute numerical millisecond values directly
    return applicationDate.getTime() >= cutoffDate.getTime();
  });

  // 4. Redraw the board using the fresh data array subset
  renderBoard();
  
  if (typeof attachCardEventListeners === "function") {
    attachCardEventListeners();
  }
}

// --- Profile Menu Module Component Event Coordinator ---
onAuthStateChanged(auth, (user) => {
  const menuContainer = document.getElementById('profile-menu-container');
  
  if (user) {
    // 1. Reveal the profile menu structure context block shell container wrapper
    if (menuContainer) menuContainer.classList.remove('hidden');

    // 2. Extract and resolve display name metadata configurations
    const rawName = user.displayName || user.email.split('@');
    const cleanedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    let initials = cleanedName.substring(0, 2).toUpperCase();
	if (cleanedName.indexOf(' ') > 0) {
		initials = user.displayName.split(' ')[0][0] + user.displayName.split(' ')[1][0];
	}

    // 3. Inject identity string values into DOM metrics elements safely
    const elName = document.getElementById('profile-display-name');
    const elInitials = document.getElementById('profile-avatar-initials');
    const elEmail = document.getElementById('profile-dropdown-email');

    if (elName) elName.textContent = cleanedName;
    if (elInitials) elInitials.textContent = initials;
    if (elEmail) elEmail.textContent = user.email;

    // 4. Initialize click bindings to support open/close state animations toggles
    initProfileDropdownInteractions();

  } else {
    // Hide panel shell assets cleanly on user session closure logouts
    if (menuContainer) menuContainer.classList.add('hidden');
	window.location.replace("index.html");
  }
});

/**
 * Attaches the complete interface event listeners required to operate 
 * the responsive floating drop-down panel matrix mechanics safely.
 */
function initProfileDropdownInteractions() {
  const trigger = document.getElementById('profile-menu-trigger');
  const dropdown = document.getElementById('profile-dropdown-card');
  const chevron = document.getElementById('profile-chevron');
  const logoutBtn = document.getElementById('btn-profile-logout');

  if (!trigger || !dropdown) return;

  // Toggle dropdown visibility visibility layout configuration variables
  function toggleDropdown(isOpen) {
    if (isOpen) {
      dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
      if (chevron) chevron.classList.add('rotate-180');
    } else {
      dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
      dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
      if (chevron) chevron.classList.remove('rotate-180');
    }
  }

  // Handle Trigger Button Clicks
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCurrentlyOpen = dropdown.classList.contains('opacity-100');
    toggleDropdown(!isCurrentlyOpen);
  });

  // Automatically close dropdown menu if user clicks anywhere else outside the frame layout bounds
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      toggleDropdown(false);
    }
  });

  // Handle Logout Execution Line Channels
  if (logoutBtn) {
    // Strip duplicate event lines
    logoutBtn.replaceWith(logoutBtn.cloneNode(true));
    const cleanLogoutBtn = document.getElementById('btn-profile-logout');
    
    cleanLogoutBtn.addEventListener('click', () => {
      signOut(auth)
        .then(() => {
          console.log("Session detached safely.");
          window.location.replace("index.html");
        })
        .catch((err) => console.error("Sign-out process failure tracking log:", err));
    });
  }
}

