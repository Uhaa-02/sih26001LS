// Initialize Socket.io connection
const socket = io();




const map = L.map('map').setView([26.15, 92.50], 8);

// Load free OpenStreetMap Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Global stores
window.zoneMarkers = {};
let monitoredZones = [];

// Helper function to resolve risk tier color
function getTierColor(tier) {
  switch (tier) {
    case 'CRITICAL': return '#dc2626'; // Red
    case 'HIGH':     return '#f97316'; // Orange
    case 'MEDIUM':   return '#eab308'; // Yellow
    case 'LOW':      return '#22c55e'; // Green
    default:         return '#64748b'; // Slate Gray
  }
}

// Fetch all zones from backend and plot on Leaflet map
async function loadZones() {
  try {
    const res = await fetch('/api/zones');
    monitoredZones = await res.json();

    const reportSelect = document.getElementById('reportZone');
    if (reportSelect) reportSelect.innerHTML = '<option value="">Select Region / Zone...</option>';

    monitoredZones.forEach(zone => {
      // 1. Populate Citizen Report Dropdown
      if (reportSelect) {
        reportSelect.innerHTML += `<option value="${zone._id}">${zone.name} (${zone.state || zone.district})</option>`;
      }

      // 2. Plot Marker on Map
      const riskScore = zone.currentRiskScore || {};
      const prob = riskScore.riskProbability || 0.30;
      const tier = riskScore.riskTier || 'MEDIUM';
      const color = getTierColor(tier);

      const marker = L.circleMarker([zone.lat, zone.lng], {
        radius: 12,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <strong style="font-size: 14px; color: #1e293b;">${zone.name}</strong><br/>
          <span style="font-size: 12px; color: #64748b;">${zone.district}, ${zone.state}</span><br/><br/>
          <strong>Risk Level:</strong> <span style="color:${color}; font-weight:bold;">${(prob * 100).toFixed(0)}% (${tier})</span>
        </div>
      `);

      window.zoneMarkers[zone._id] = marker;

      // Render Initial Telemetry Card
      renderTelemetryCard({
        zoneId: zone._id,
        zoneName: zone.name,
        riskProbability: prob,
        riskTier: tier,
        telemetry: riskScore.telemetry || { precipitation_mm: 0, soil_moisture: 0.20 }
      });
    });
      if (monitoredZones.length > 0) {
      const group = L.featureGroup(Object.values(window.zoneMarkers));
      map.fitBounds(group.getBounds().pad(0.2));
    }
    setTimeout(() => map.invalidateSize(), 300);
  } catch (err) {
    console.error('Failed to load zones:', err);
  }
}

// Helper function to dynamically render live telemetry cards
function renderTelemetryCard(data) {
  const container = document.getElementById("liveTelemetryCards");
  if (!container) return;

  // Clear initial loading message if present
  if (container.children.length === 1 && container.children[0].classList.contains('col-span-full')) {
    container.innerHTML = '';
  }

  let card = document.getElementById(`telemetry-card-${data.zoneId}`);
  const cardColor = getTierColor(data.riskTier);

  const cardContent = `
    <div class="flex justify-between items-center mb-2">
      <span class="font-bold text-sm text-slate-800">${data.zoneName || 'Zone ' + data.zoneId}</span>
      <span class="px-2 py-0.5 text-xs font-bold rounded text-white" style="background-color: ${cardColor}">
        ${data.riskTier} (${(data.riskProbability * 100).toFixed(0)}%)
      </span>
    </div>
    <div class="text-xs text-slate-600 space-y-1.5 border-t border-slate-200 pt-2">
      <div class="flex justify-between"><span>Rainfall (Open-Meteo):</span> <strong class="text-slate-800">${data.telemetry?.precipitation_mm ?? 0} mm/h</strong></div>
      <div class="flex justify-between"><span>Soil Moisture:</span> <strong class="text-slate-800">${data.telemetry?.soil_moisture ?? 0.2} m³/m³</strong></div>
      <div class="flex justify-between text-slate-400 text-[10px]"><span>Last Polled:</span> <span>${new Date().toLocaleTimeString()}</span></div>
    </div>
  `;

  if (card) {
    card.innerHTML = cardContent;
  } else {
    const newCard = document.createElement("div");
    newCard.id = `telemetry-card-${data.zoneId}`;
    newCard.className = "p-3.5 bg-slate-50 rounded-lg border border-slate-200 shadow-sm transition-all duration-300";
    newCard.innerHTML = cardContent;
    container.appendChild(newCard);
  }
}

// Socket.io Listener for Automatic Telemetry Updates (Every 15 minutes)
socket.on('risk_update', (data) => {
  console.log('⚡ Auto Telemetry Update Received:', data);

  // 1. Dynamic Map Marker Color Update
  if (window.zoneMarkers && window.zoneMarkers[data.zoneId]) {
    const marker = window.zoneMarkers[data.zoneId];
    if (marker.setStyle) {
      marker.setStyle({ fillColor: getTierColor(data.riskTier), color: '#ffffff' });
    }
  }

  // 2. Update Live Telemetry Card
  renderTelemetryCard(data);

  // 3. Prepend Log into Dispatch Feed
  const feed = document.getElementById('dispatchFeed');
  if (feed) {
    const entry = document.createElement('div');
    entry.className = `p-2 my-1 text-xs rounded bg-slate-800 border-l-4 ${
      data.riskTier === 'CRITICAL' ? 'border-red-500 text-red-300' : 'border-blue-500 text-slate-200'
    }`;
    entry.innerText = `[AUTO-TELEMETRY 15m] ${data.zoneName || 'Zone ' + data.zoneId}: Calculated risk probability updated to ${(data.riskProbability * 100).toFixed(0)}% (${data.riskTier})`;
    feed.prepend(entry);
  }
});

// Citizen Ground-Truth Photo Reporting Form Handler
const reportForm = document.getElementById('groundReportForm');
if (reportForm) {
  reportForm.onsubmit = async (e) => {
    e.preventDefault();
    const zoneId = document.getElementById('reportZone').value;
    const severity = document.getElementById('severityRange').value;
    const description = document.getElementById('reportDesc').value;
    const photoInput = document.getElementById('photoUpload');

    if (!zoneId) {
      alert('Please select a target region/zone.');
      return;
    }

    const formData = new FormData();
    formData.append('zoneId', zoneId);
    formData.append('severityEstimate', severity);
    formData.append('description', description);
    if (photoInput && photoInput.files[0]) {
      formData.append('photo', photoInput.files[0]);
    }

    try {
      const res = await fetch('/api/feedback/report', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('Ground-truth report submitted! Risk score nudged successfully.');
        reportForm.reset();
        document.getElementById('severityVal').innerText = "0.50";
      } else {
        alert('Failed to submit report: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to process crowdsourced report.');
    }
  };
}

// MoDNER AI Emergency Response Assistant Handlers
async function sendChatbotIntent(intent) {
  const chatBox = document.getElementById('chatMessages');
  if (!chatBox) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'p-2 my-1 text-xs rounded bg-blue-100 text-blue-900 self-end text-right';
  userBubble.innerText = `Request: ${intent.replace('_', ' ')}`;
  chatBox.appendChild(userBubble);

  try {
    const res = await fetch('/api/chatbot/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent })
    });
    const data = await res.json();

    const botBubble = document.createElement('div');
    botBubble.className = 'p-2 my-1 text-xs rounded bg-slate-100 text-slate-800 font-mono whitespace-pre-line';
    botBubble.innerText = data.reply || 'No response received.';
    chatBox.appendChild(botBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    const errBubble = document.createElement('div');
    errBubble.className = 'p-2 my-1 text-xs rounded bg-red-100 text-red-800';
    errBubble.innerText = 'Unable to fetch emergency data right now.';
    chatBox.appendChild(errBubble);
  }
}

// Initialize Application
function init() {
  loadZones();
}

init();