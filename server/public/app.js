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
        telemetry: (riskScore.inputSnapshot && riskScore.inputSnapshot.telemetry) || riskScore.telemetry || { precipitation_mm: 0, soil_moisture: 0.20 }
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
  const tierColor = getTierColor(data.riskTier);
  const pct = (data.riskProbability * 100).toFixed(0);
  const rain = data.telemetry?.precipitation_mm ?? 0;
  const soil = data.telemetry?.soil_moisture ?? 0.2;

  const cardContent = `
    <div class="tcard-accent" style="background-color: ${tierColor}"></div>
    <div class="p-3.5">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="min-w-0">
          <p class="font-bold text-sm text-gov-900 leading-tight truncate">${data.zoneName || 'Zone ' + data.zoneId}</p>
          <p class="text-[10px] uppercase tracking-wide text-gov-950/50 mt-0.5">Monitored zone</p>
        </div>
        <span class="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded text-white uppercase tracking-wide" style="background-color: ${tierColor}">
          ${data.riskTier}
        </span>
      </div>

      <div class="flex items-end gap-2 mb-3">
        <span class="text-3xl font-bold leading-none" style="color: ${tierColor}">${pct}<span class="text-lg">%</span></span>
        <span class="text-[10px] text-gov-950/50 pb-1">risk probability</span>
      </div>
      <div class="w-full h-1.5 rounded-full bg-gov-100 overflow-hidden mb-3">
        <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${tierColor}"></div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="tcard-metric p-2">
          <p class="text-[10px] text-gov-950/50 uppercase tracking-wide">Rainfall</p>
          <p class="text-sm font-bold text-gov-900 leading-tight">${rain}<span class="text-[10px] font-semibold text-gov-950/50"> mm/h</span></p>
        </div>
        <div class="tcard-metric p-2">
          <p class="text-[10px] text-gov-950/50 uppercase tracking-wide">Soil moisture</p>
          <p class="text-sm font-bold text-gov-900 leading-tight">${soil}<span class="text-[10px] font-semibold text-gov-950/50"> m³/m³</span></p>
        </div>
      </div>

      <p class="text-[10px] text-gov-950/50 mt-2.5 pt-2 border-t border-gov-100 flex justify-between">
        <span>Last polled</span><span>${new Date().toLocaleTimeString()}</span>
      </p>
    </div>
  `;

  if (card) {
    card.innerHTML = cardContent;
  } else {
    const newCard = document.createElement("div");
    newCard.id = `telemetry-card-${data.zoneId}`;
    newCard.className = "tcard";
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
    entry.className = `p-2 my-1 text-xs rounded bg-gov-900 border-l-4 ${
      data.riskTier === 'CRITICAL' ? 'border-red-500 text-red-200' : 'border-saffron-400 text-gov-100'
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
  userBubble.className = 'p-2 my-1 text-xs rounded bg-gov-100 text-gov-900 self-end text-right';
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
    botBubble.className = 'p-2 my-1 text-xs rounded bg-white border border-gov-100 text-gov-950 font-mono whitespace-pre-line';
    botBubble.innerText = data.reply || 'No response received.';
    chatBox.appendChild(botBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    const errBubble = document.createElement('div');
    errBubble.className = 'p-2 my-1 text-xs rounded bg-red-50 border border-red-200 text-red-800';
    errBubble.innerText = 'Unable to fetch emergency data right now.';
    chatBox.appendChild(errBubble);
  }
}

// Initialize Application
function init() {
  loadZones();
}

init();