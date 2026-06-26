import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";

// Memory storage cache for handling fast client-side UI manipulation sorting routines
let datasetCache = [];
let activeSortField = "dateApplied"; // Start default sorted by applied date
let isAscendingOrder = false;       // Newest applications display at top first

// Track the explicit sorting vector (true = Ascending, false = Descending) for each individual column field
const columnSortDirections = {
  companyName: false,
  jobTitle: true,
  status: true,
  location: true,
  dateApplied: false // Start date tracking looking at newest submissions first
};

const tableBody = document.getElementById("list-table-body");

/**
 * Builds the actual table HTML body markup using current sorting definitions
 */
//import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
//import { db, auth } from "./firebase-config.js";

//let datasetCache = [];
//let activeSortField = "dateApplied"; 
//let isAscendingOrder = false;       
let activeGroupingMode = "none"; // Options: "none", "companyName", "status"

//const tableBody = document.getElementById("list-table-body");
const groupSummaryBadge = document.getElementById("group-summary-badge");

/**
 * Builds standard individual data row markup strings
 */
function buildRowHtml(app) {
  const company = app.companyName || "Unknown Company";
  const title = app.jobTitle || "Untitled Position";
  const status = app.status || "Pre-Application";
  const locationStr = app.location ? `${app.locationType || "Onsite"} (${app.location})` : (app.locationType || "Remote");
  const dateStr = app.dateApplied || "—";

  let statusClass = "bg-slate-100 text-slate-700";
  if (status === "Applied") statusClass = "bg-blue-50 text-blue-700 border-blue-100 border";
  if (status === "Interviewing") statusClass = "bg-amber-50 text-amber-700 border-amber-100 border";
  if (status === "Offered") statusClass = "bg-emerald-50 text-emerald-700 border-emerald-100 border font-medium";
  if (status === "Rejected") statusClass = "bg-rose-50 text-rose-700 border-rose-100 border";

  return `
    <tr class="hover:bg-slate-50/70 transition-colors">
      <td class="p-4 font-bold text-slate-900">${company}</td>
      <td class="p-4 text-slate-600 font-medium">${title}</td>
      <td class="p-4">
        <span class="text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${statusClass}">
          ${status}
        </span>
      </td>
      <td class="p-4 text-slate-500 font-medium">${locationStr}</td>
      <td class="p-4 text-slate-500 font-mono font-medium">${dateStr}</td>
    </tr>
  `;
}

/**
 * Renders the list table supporting flat views or categorized grouped structures
 */
function renderListTable() {
  if (datasetCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-slate-400 font-medium bg-white">No applications tracked in this view pipeline yet.</td></tr>`;
    groupSummaryBadge.textContent = "";
    return;
  }

  // OPTION A: Standard flat layout rendering pattern
  if (activeGroupingMode === "none") {
    groupSummaryBadge.textContent = "Showing standard flat master track roster";
    tableBody.innerHTML = datasetCache.map(app => buildRowHtml(app)).join("");
    return;
  }

  // OPTION B: Cluster categorization grouping pattern
  groupSummaryBadge.textContent = `Grouped records by application ${activeGroupingMode === "companyName" ? "company labels" : "pipeline stages"}`;

  // 1. Cluster documents into dictionary map lists
  const groupedBuckets = {};
  datasetCache.forEach(app => {
    const rawKeyValue = app[activeGroupingMode];
    const groupKey = rawKeyValue ? rawKeyValue.trim() : (activeGroupingMode === "companyName" ? "Unassigned Company" : "Pre-Application");
    
    if (!groupedBuckets[groupKey]) {
      groupedBuckets[groupKey] = [];
    }
    groupedBuckets[groupKey].push(app);
  });

  // 2. Sort the cluster header keys alphabetically so order remains predictable
  const sortedGroupKeys = Object.keys(groupedBuckets).sort((a, b) => a.localeCompare(b));

  // 3. Assemble markup containing custom separator header elements
  let finalAssembledHtml = "";
  
  sortedGroupKeys.forEach(groupTitle => {
    const recordsInGroup = groupedBuckets[groupTitle];
    
    // Inject a full-width subheader divider separating data rows
    finalAssembledHtml += `
      <tr class="bg-slate-100/80 border-y border-slate-200 select-none">
        <td colspan="5" class="p-3 text-xs font-bold uppercase tracking-wider text-slate-600 px-4">
          📁 ${groupTitle} <span class="ml-1 text-[11px] font-semibold text-slate-400">(${recordsInGroup.length} ${recordsInGroup.length === 1 ? 'record' : 'records'})</span>
        </td>
      </tr>
    `;

    // Append child data rows belonging underneath this targeted tracking group header block
    finalAssembledHtml += recordsInGroup.map(app => buildRowHtml(app)).join("");
  });

  tableBody.innerHTML = finalAssembledHtml;
}


/**
 * Handles toggling active classes styling metrics inside visual grouping button bars
 */
function updateGroupingUiButtons(selectedMode) {
  activeGroupingMode = selectedMode;
  
  const buttons = {
    "none": document.getElementById("btn-group-none"),
    "companyName": document.getElementById("btn-group-company"),
    "status": document.getElementById("btn-group-status")
  };

  Object.keys(buttons).forEach(modeKey => {
    const btn = buttons[modeKey];
    if (!btn) return;

    if (modeKey === selectedMode) {
      btn.className = "px-4 py-1.5 rounded-md font-semibold text-xs transition duration-150 bg-white text-slate-800 shadow-xs";
    } else {
      btn.className = "px-4 py-1.5 rounded-md font-semibold text-xs transition duration-150 text-slate-600 hover:text-slate-900";
    }
  });

  renderListTable();
}

// --- Interactive Click Action Interceptors Event Bindings Layout setup ---
document.querySelectorAll(".sortable-header").forEach(header => {
  header.addEventListener("click", () => sortData(header.getAttribute("data-sort")));
});

document.getElementById("btn-group-none").addEventListener("click", () => updateGroupingUiButtons("none"));
document.getElementById("btn-group-company").addEventListener("click", () => updateGroupingUiButtons("companyName"));
document.getElementById("btn-group-status").addEventListener("click", () => updateGroupingUiButtons("status"));

// --- Auth Watcher State Synchronization Pipeline wire ---
auth.onAuthStateChanged((user) => {
  if (user) {
    onSnapshot(collection(db, `users/${user.uid}/applications`), (snapshot) => {
      datasetCache = [];
      snapshot.forEach(doc => {
        datasetCache.push({ id: doc.id, ...doc.data() });
      });

      const currentActiveField = activeSortField;
      const currentOrder = isAscendingOrder;
      activeSortField = ""; 
      isAscendingOrder = currentOrder;
      sortData(currentActiveField);
    }, (error) => {
      console.error("List sync stream failed:", error);
      tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-600 font-medium">Error linking to secure database live channels.</td></tr>`;
    });
  } else {
    window.location.replace("index.html");
  }
});

/**
 * Executes a client-side alphanumeric sort on the internal data cache array.
 * @param {string} field - The property string key to sort by.
 * @param {boolean} isLiveSync - True if triggered by Firestore, False if a manual click.
 */
function sortData(field, isLiveSync = false) {
  // 1. ONLY flip the direction vector if a human manually clicks the active column header
  if (activeSortField === field && !isLiveSync) {
    columnSortDirections[field] = !columnSortDirections[field];
  }
  
  // Explicitly set the active field pointer
  activeSortField = field;
  const isAscending = columnSortDirections[field];

  // 2. Perform the matching alphanumeric array sort
  datasetCache.sort((a, b) => {
    let valA = (a[field] || "").toString().toLowerCase();
    let valB = (b[field] || "").toString().toLowerCase();

    // Numerical parsing fallback targets for safety
    if (!isNaN(valA) && !isNaN(valB) && valA !== "" && valB !== "") {
      valA = Number(valA);
      valB = Number(valB);
    }

    if (valA < valB) return isAscending ? -1 : 1;
    if (valA > valB) return isAscending ? 1 : -1;
    return 0;
  });

  // 3. Redraw view components
  updateHeaderIcons();
  renderListTable();
}

// Handle manual click events on the table headers
document.querySelectorAll(".sortable-header").forEach(header => {
  header.addEventListener("click", () => {
    // Regular user click -> toggles direction fluidly
    sortData(header.getAttribute("data-sort"), false);
  });
});

/**
 * Updates UI direction arrows inside standard heading elements mapping vectors
 */
function updateHeaderIcons() {
  document.querySelectorAll(".sortable-header").forEach(header => {
    const iconSpan = header.querySelector(".sort-icon");
    const targetField = header.getAttribute("data-sort");

    if (targetField === activeSortField) {
      // Look up direction vectors directly out of the independent tracking matrix mapper
      const isAscending = columnSortDirections[targetField];
      iconSpan.textContent = isAscending ? " 🔼" : " 🔽";
      header.classList.add("text-blue-600", "bg-slate-50/80");
    } else {
      iconSpan.textContent = "";
      header.classList.remove("text-blue-600", "bg-slate-50");
    }
  });
}

// --- Dynamic Interactive Event Bindings ---
document.querySelectorAll(".sortable-header").forEach(header => {
  header.addEventListener("click", () => {
    sortData(header.getAttribute("data-sort"));
  });
});

// --- Auth Watcher State Synchronization Pipeline wire ---
auth.onAuthStateChanged((user) => {
  if (user) {
    onSnapshot(collection(db, `users/${user.uid}/applications`), (snapshot) => {
      datasetCache = [];
      snapshot.forEach(doc => {
        datasetCache.push({ id: doc.id, ...doc.data() });
      });

      // Maintain current sorting profile rules safely, passing true for isLiveSync
      sortData(activeSortField, true);
      
    }, (error) => {
      console.error("List sync stream failed:", error);
    });
  } else {
    window.location.replace("index.html");
  }
});