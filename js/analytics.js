import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

// Global Chart Registry Objects (Prevents canvas context collision canvas errors)
let funnelChartInstance = null;
let latencyChartInstance = null;
let velocityChartInstance = null;
let isUsingSimulatedData = false;

/**
 * Core Data Analytics Pipeline Entry Point
 */
function processPipelineAnalytics(applications) {	

debugger;

  // Check if the user has a critically low amount of data (e.g., less than 2 entries)
  // or if they lack records with the necessary metric histories (like dateResponded)
  const recordsWithResponses = applications.filter(a => a.dateResponded && a.dateResponded.trim() !== "");
  
  isUsingSimulatedData = applications.length < 3 || recordsWithResponses.length === 0;

  const banner = document.getElementById("simulated-data-banner");
  if (banner) {
    isUsingSimulatedData ? banner.classList.remove("hidden") : banner.classList.add("hidden");
  }
  
  // Update Top Scorecard Metric Headers
  updateScorecardsUi(applications);

  // Compile individual data matrices blocks
  renderConversionFunnel(applications);
  renderResponseLatency(applications);
  renderApplicationVelocity(applications);
}

/**
 * Standard Metric Cards Counter Updates
 */
function updateScorecardsUi(apps) {
  const total = apps.length;
  const interviewing = apps.filter(a => a.status === "Interviewing").length;
  const conversions = apps.filter(a => ["Interviewing", "Offered"].includes(a.status)).length;
  const rate = total > 0 ? Math.round((conversions / total) * 100) : 0;

  document.getElementById("metric-total-apps").textContent = total;
  document.getElementById("metric-active-interviews").textContent = interviewing;
  document.getElementById("metric-conversion-rate").textContent = `${rate}%`;
}

/**
 * 1. Chart Module: Conversion Metrics Funnel
 */
function renderConversionFunnel(apps) {
  const ctx = document.getElementById('chart-funnel-funnel');
  if (!ctx) return;

  // Track counts across your explicit pipeline stages
  const stages = { "Applied": 0, "Interviewing": 0, "Offered": 0 };
  apps.forEach(a => {
    if (stages[a.status] !== undefined) stages[a.status]++;
  });

  if (funnelChartInstance) funnelChartInstance.destroy();

  funnelChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1. Submitted Applications', '2. Secured Interviews', '3. Received Offers'],
      datasets: [{
        label: 'Applications Volume',
        data: [stages["Applied"] + stages["Interviewing"] + stages["Offered"], stages["Interviewing"] + stages["Offered"], stages["Offered"]],
        backgroundColor: ['rgba(59, 130, 246, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(16, 185, 129, 0.9)'],
        borderRadius: 8,
        barThickness: 32
      }]
    },
    options: {
      indexAxis: 'y', // Makes the chart run horizontally like a pipeline funnel drop-off structure
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } }
    }
  });
}

/**
 * 2. Chart Module: Response Latency Tracker
 * Uses application document properties to calculate turnaround intervals.
 */
function renderResponseLatency(apps) {
  const ctx = document.getElementById('chart-response-latency');
  if (!ctx) return;

  const latencyCategories = { "Interviewing": { totalDays: 0, count: 0 }, "Rejected": { totalDays: 0, count: 0 } };

  apps.forEach(app => {
    // Requires standard ISO date strings in app.dateApplied & an app.dateResponded update property string
    if (app.dateApplied && app.dateResponded && latencyCategories[app.status]) {
      const start = new Date(app.dateApplied.trim() + "T00:00:00");
      const end = new Date(app.dateResponded.trim() + "T00:00:00");
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
          latencyCategories[app.status].totalDays += diffDays;
          latencyCategories[app.status].count++;
        }
      }
    }
  });

  // Calculate averages; fallback to a default simulated lookup array value if data collection pool is fresh
  const avgInterviewDays = latencyCategories["Interviewing"].count > 0 ? Math.round(latencyCategories["Interviewing"].totalDays / latencyCategories["Interviewing"].count) : 14;
  const avgRejectionDays = latencyCategories["Rejected"].count > 0 ? Math.round(latencyCategories["Rejected"].totalDays / latencyCategories["Rejected"].count) : 22;

  if (latencyChartInstance) latencyChartInstance.destroy();

  latencyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['To Interview Invite', 'To Final Response'],
      datasets: [{
        data: [avgInterviewDays, avgRejectionDays],
        backgroundColor: ['rgba(217, 119, 6, 0.8)', 'rgba(225, 29, 72, 0.8)'],
        borderRadius: 6,
        maxBarThickness: 50
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Average Days' } }, x: { grid: { display: false } } }
    }
  });
  
  debugger;
  
// Inside your renderResponseLatency(apps) function:
const demoBadge = isUsingSimulatedData 
  ? `<span class="ml-2 inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">Demo Mode</span>` 
  : '';

// Target your title element wrapper container
document.getElementById('chart-response-latency-label').innerHTML = `
  <h3 class="text-sm font-bold text-slate-800">⏱️ Response Latency Tracker (Average Days) ${demoBadge}</h3>
`;  
}

/**
 * 3. Chart Module: Application Velocity Chart
 * Sorts data chronologically and bins entries into distinct operational weeks.
 */
function renderApplicationVelocity(apps) {
  const ctx = document.getElementById('chart-velocity-timeline');
  if (!ctx) return;

  const weeklyBins = {};

  apps.forEach(app => {
    if (!app.dateApplied || app.dateApplied.trim() === "") return;
    
    const date = new Date(app.dateApplied.trim() + "T00:00:00");
    if (isNaN(date.getTime())) return;

    // Determine the start date of the target week (Sunday)
    const dayOfWeek = date.getDay();
    const sundayDate = new Date(date);
    sundayDate.setDate(date.getDate() - dayOfWeek);
    
    const weekKey = sundayDate.toISOString().slice(0, 10); // Format: "YYYY-MM-DD"

    weeklyBins[weekKey] = (weeklyBins[weekKey] || 0) + 1;
  });

  // Sort chronological week paths ascending order
  const sortedWeeks = Object.keys(weeklyBins).sort((a, b) => new Date(a) - new Date(b));
  const chartLabels = sortedWeeks.map(weekStr => {
    const d = new Date(weekStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const chartData = sortedWeeks.map(weekStr => weeklyBins[weekStr]);

  if (velocityChartInstance) velocityChartInstance.destroy();

  velocityChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels.length > 0 ? chartLabels : ["No historical data available"],
      datasets: [{
        label: 'Weekly Submissions',
        data: chartData.length > 0 ? chartData : '',
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.06)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#1d4ed8',
        pointRadius: 4.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { 
        y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Submissions Count' } },
        x: { grid: { display: false } }
      }
    }
  });
  
// Inside your renderResponseLatency(apps) function:
const demoBadge = isUsingSimulatedData 
  ? `<span class="ml-2 inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">Not Enough Data Available</span>` 
  : '';

// Target your title element wrapper container
document.getElementById('chart-application-velocity-label').innerHTML = `
  <h3 class="text-sm font-bold text-slate-800">🏃‍♂️ Application Velocity Chart ${demoBadge}</h3>
`;    
}

// --- Wire Database Subscription Stream Channels ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    onSnapshot(collection(db, `users/${user.uid}/applications`), (snapshot) => {
      const liveApplicationsCache = [];
      snapshot.forEach(doc => {
        liveApplicationsCache.push({ id: doc.id, ...doc.data() });
      });

      // Pass raw payload into computing engine
      processPipelineAnalytics(liveApplicationsCache);
    }, (error) => {
		debugger;
      console.error("Analytics Stream Subscriptions Broker Down:", error);
    });
  } else {
    window.location.replace("index.html");
  }
});


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

