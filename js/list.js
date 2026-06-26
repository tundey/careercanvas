import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

// Master Caches
let rawApplicationsCache = []; // Untouched Firestore documents stream
let filteredApplications = [];  // Filtered down using Date metrics values

// View States Configuration States
let activeSortField = "dateApplied";
let activeGroupingMode = "none"; // Values: "none", "companyName", "status", "tag"

// Fully decoupled independent bi-directional sorting history records matrix maps
const columnSortDirections = {
  companyName: true,
  jobTitle: true,
  status: true,
  tag: true,
  locationType: true,
  dateApplied: false // Show newest additions first by default
};

// DOM Node References
const tableBody = document.getElementById("list-table-body");
const groupSummaryBadge = document.getElementById("group-summary-badge");
const recordCountBadge = document.getElementById("record-count-badge");
const dateInput = document.getElementById("filter-start-date");

// Helper function to calculate a default 30-day lookback date string (YYYY-MM-DD)
function getPastDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

/**
 * 1. Filtering Module: Evaluates calendar dates as formal JS Date objects
 * along with real-time case-insensitive free-form text search terms.
 */
function applyListFilters() {
  if (!dateInput || !dateInput.value) return;

  // Gather text input field node references
  const searchCompanyInput = document.getElementById("filter-search-company");
  const searchTitleInput = document.getElementById("filter-search-title");

  // Read clean lowercase filter string query parameters
  const companyQuery = searchCompanyInput ? searchCompanyInput.value.toLowerCase().trim() : "";
  const titleQuery = searchTitleInput ? searchTitleInput.value.toLowerCase().trim() : "";

  // Build local midnight instance matching cutoff values exactly
  const cutoffDate = new Date(dateInput.value + "T00:00:00");
  cutoffDate.setHours(0, 0, 0, 0);

  // Filter local document arrays cache
  filteredApplications = rawApplicationsCache.filter(app => {
    // A. Verify Date constraints first
    if (!app.dateApplied || app.dateApplied.trim() === '') return false;
    const applicationDate = new Date(app.dateApplied.trim() + "T00:00:00");
    applicationDate.setHours(0, 0, 0, 0);
    
    if (applicationDate.getTime() < cutoffDate.getTime()) return false;

    // B. Check free-form Text Search conditions (Fuzzy string parsing match checks)
    const appCompany = (app.companyName || "").toLowerCase();
    const appTitle = (app.jobTitle || "").toLowerCase();

    if (companyQuery !== "" && !appCompany.includes(companyQuery)) return false;
    if (titleQuery !== "" && !appTitle.includes(titleQuery)) return false;

    return true; // Document passed all requirements successfully
  });

  if (recordCountBadge) {
    recordCountBadge.textContent = `${filteredApplications.length} records matching parameters`;
  }

debugger;
  // Pass current updates through sorting layouts and re-render the rows
  sortListData(activeSortField, true);
}

/**
 * 2. Sorting Module: Decoupled Alphanumeric Bidirectional Sorting Vector Loops
 */
function sortListData(field, isLiveSync = false) {
	  // If clicked manually, toggle direction vector flags
	  if (activeSortField === field && !isLiveSync) {
		columnSortDirections[field] = !columnSortDirections[field];
	  }

	  activeSortField = field;
	  const isAscending = columnSortDirections[field];

	filteredApplications.sort((a, b) => {
    // Handle formal Date sorting chronologically
    if (field === "dateApplied") {
      const timeA = a.dateApplied ? new Date(a.dateApplied.trim()).getTime() : 0;
      const timeB = b.dateApplied ? new Date(b.dateApplied.trim()).getTime() : 0;
      
      // Fix: Corrected the directional assignment vectors
      // Ascending (true) = Oldest first (timeA - timeB)
      // Descending (false) = Newest first (timeB - timeA)
      return isAscending ? (timeA - timeB) : (timeB - timeA);
    }

    // Default Fallback string comparisons for regular text columns
    let valA = (a[field] || "").toString().toLowerCase().trim();
    let valB = (b[field] || "").toString().toLowerCase().trim();

    if (valA < valB) return isAscending ? -1 : 1;
    if (valA > valB) return isAscending ? 1 : -1;
    return 0;
  });
  
  updateSortHeaderIcons();
  renderListRegistrySheet();
}

/**
 * 3. Render Module: Builds rows and partitions clusters based on grouping selections
 */
function renderListRegistrySheet() {
  if (filteredApplications.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 font-medium bg-white">No applications match the active timeframe criteria parameters.</td></tr>`;
    if (groupSummaryBadge) groupSummaryBadge.textContent = "Filtered results pool clean";
    return;
  }

  // Handle standard Flat Grid Sheet layouts
  if (activeGroupingMode === "none") {
    if (groupSummaryBadge) groupSummaryBadge.textContent = "Showing un-grouped standard flat master track list roster";
    tableBody.innerHTML = filteredApplications.map(app => buildRowElementHtml(app)).join("");
    return;
  }

  // Process multi-tier cluster groupings bucket mapping maps
  const cleanLabelMap = { companyName: "companies", status: "pipeline stages", tag: "sub-status milestones" };
  if (groupSummaryBadge) groupSummaryBadge.textContent = `Segmenting rows by active parameter: ${cleanLabelMap[activeGroupingMode]}`;

  const groups = {};
  filteredApplications.forEach(app => {
    const rawVal = app[activeGroupingMode];
    const groupKey = rawVal && rawVal.trim() !== "" ? rawVal.trim() : (activeGroupingMode === "tag" ? "Untagged Track Actions" : "Pre-Application");

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(app);
  });

  // Sort keys alphabetically so grouped tables stay ordered cleanly
  const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  let finalHtml = "";

  sortedKeys.forEach(title => {
    const records = groups[title];
    finalHtml += `
      <tr class="bg-slate-100/90 border-y border-slate-200/80 select-none">
        <td colspan="6" class="p-3 text-xs font-bold uppercase tracking-wider text-slate-600 px-4">
          📁 ${title} <span class="ml-1 text-[11px] font-semibold text-slate-400">(${records.length} ${records.length === 1 ? 'record' : 'records'})</span>
        </td>
      </tr>
    `;
    finalHtml += records.map(app => buildRowElementHtml(app)).join("");
  });

  tableBody.innerHTML = finalHtml;
}

/**
 * Compiles specific row segments matching application properties
 */
function buildRowElementHtml(app) {
const company = app.companyName || "Unknown Company";
  const title = app.jobTitle || "Untitled Position";
  const status = app.status || "Pre-Application";
  const tag = app.tag ? app.tag.trim() : "";
  const location = app.location ? `${app.locationType || "Onsite"} (${app.location})` : (app.locationType || "Remote");
  
  // --- Dynamic Date Applied Formatting Engine ---
  let formattedDateDisplay = "—";
  
  if (app.dateApplied && app.dateApplied.trim() !== '') {
	const dateObj = new Date(app.dateApplied.trim());
    // Ensure the date string successfully evaluated into a valid Date object instance
    if (!isNaN(dateObj.getTime())) {
      formattedDateDisplay = dateObj.toLocaleDateString('en-US', {
        month: 'short',   // "Jan", "Feb", etc.
        day: 'numeric',   // "1", "2", "26"
        year: 'numeric'   // "2026"
      });
    } else {
      formattedDateDisplay = app.dateApplied; // Fallback to raw string if parsing fails
    }
  }

  // Macro Color Themes
  let statusClass = "bg-slate-100 text-slate-700 border border-slate-200";
  if (status === "Applied") statusClass = "bg-blue-50 text-blue-700 border-blue-100 border";
  if (status === "Interviewing") statusClass = "bg-amber-50 text-amber-700 border-amber-100 border";
  if (status === "Offered") statusClass = "bg-emerald-50 text-emerald-700 border-emerald-100 border font-medium";
  if (status === "Rejected") statusClass = "bg-rose-50 text-rose-700 border-rose-100 border";

  // Micro Color Themes
  const tagColors = {
    'Under Review':          'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Follow-up Sent':        'bg-purple-50 text-purple-700 border-purple-200',
    'Awaiting Response':     'bg-sky-50 text-sky-700 border-sky-200',
    'On Hold':               'bg-orange-50 text-orange-700 border-orange-200',
    'Offer Accepted':        'bg-teal-50 text-teal-700 border-teal-200 font-medium',
    'Start Date Confirmed':  'bg-green-100 text-green-800 border-green-300 font-semibold',
    'Position Filled':       'bg-rose-50 text-rose-600 border-rose-100',
    'Not Selected':          'bg-rose-100 text-rose-700 border-rose-200'
  };
  const tagClass = tagColors[tag] || 'bg-slate-50 text-slate-400 border-slate-200/50 text-[11px]';

  return `
    <tr class="hover:bg-slate-50/60 transition-colors">
      <td class="p-4 font-bold text-slate-900">${company}</td>
      <td class="p-4 text-slate-600 font-medium">${title}</td>
      <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${statusClass}">${status}</span></td>
      <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-md border tracking-wide ${tagClass}">${tag || '—'}</span></td>
      <td class="p-4 text-slate-500 font-medium">${location}</td>
      <td class="p-4 text-slate-500 font-mono font-medium">${formattedDateDisplay}</td>
    </tr>
  `;
}

function updateSortHeaderIcons() {
  document.querySelectorAll(".sortable-header").forEach(header => {
    const icon = header.querySelector(".sort-icon");
    const field = header.getAttribute("data-sort");

    if (field === activeSortField) {
      icon.textContent = columnSortDirections[field] ? " 🔼" : " 🔽";
      header.className = "sortable-header p-4 cursor-pointer text-blue-600 bg-slate-50/80 transition font-bold";
    } else {
      icon.textContent = "";
      header.className = "sortable-header p-4 cursor-pointer hover:bg-slate-100 text-slate-500 transition font-bold";
    }
  });
}

function updateGroupButtonsUi(selectedMode) {
  activeGroupingMode = selectedMode;
  const ids = { none: "btn-group-none", companyName: "btn-group-company", status: "btn-group-status", tag: "btn-group-tag" };

  Object.keys(ids).forEach(key => {
    const btn = document.getElementById(ids[key]);
    if (!btn) return;
    btn.className = (key === selectedMode)
      ? "group-btn px-3.5 py-1.5 rounded-md font-semibold text-xs bg-white text-slate-800 shadow-xs transition"
      : "group-btn px-3.5 py-1.5 rounded-md font-semibold text-xs text-slate-600 hover:text-slate-900 transition";
  });

  renderListRegistrySheet();
}

// --- Wire Listeners ---
document.querySelectorAll(".sortable-header").forEach(h => {
  h.addEventListener("click", () => sortListData(h.getAttribute("data-sort"), false));
});

document.getElementById("btn-group-none").addEventListener("click", () => updateGroupButtonsUi("none"));
document.getElementById("btn-group-company").addEventListener("click", () => updateGroupButtonsUi("companyName"));
document.getElementById("btn-group-status").addEventListener("click", () => updateGroupButtonsUi("status"));
document.getElementById("btn-group-tag").addEventListener("click", () => updateGroupButtonsUi("tag"));

if (dateInput) {
  dateInput.addEventListener("change", () => applyListFilters());
}

// --- Wire Database Subscription Stream Channels ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Standardize baseline lookback constraints mapping structures
    if (dateInput && !dateInput.value) {
      dateInput.value = getPastDateString(30);
    }

    onSnapshot(collection(db, `users/${user.uid}/applications`), (snapshot) => {
      rawApplicationsCache = [];
      snapshot.forEach(doc => {
        rawApplicationsCache.push({ id: doc.id, ...doc.data() });
      });

      applyListFilters();
    }, (error) => {
      console.error("Firestore Registry Synchronizer Crash:", error);
    });
  } else {
    window.location.replace("index.html");
  }
});

// --- Text Inputs Real-Time Observers Hooks ---
const searchCompanyInput = document.getElementById("filter-search-company");
const searchTitleInput = document.getElementById("filter-search-title");

if (searchCompanyInput) {
  searchCompanyInput.addEventListener("input", () => applyListFilters());
}

if (searchTitleInput) {
  searchTitleInput.addEventListener("input", () => applyListFilters());
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

