// Live river discharge forecasts (Open-Meteo Flood API / GloFAS) for Abuja flood hotspots.
// Loads after map.js, which provides the globals `map` and the pane_PotentialFloodZones_1 pane.

const FLOOD_GAUGES = [
    { id: 'wuse2', name: 'Wuse 2 - Adetokunbo Ademola Crescent', lat: 9.0765, lng: 7.4837, context: 'Cars submerged, businesses closed (Aug 15 flood)', thresholds: { watch: 0.91, warning: 1.18, critical: 1.94 } },
    { id: 'gudu', name: 'Gudu - Delight Event Centre / Ebeano-Gudu Rd', lat: 9.0270, lng: 7.4610, context: 'Flooded road and bridge, stranded motorists', thresholds: { watch: 1.44, warning: 1.86, critical: 3.24 } },
    { id: 'lokogoma', name: 'Lokogoma - Efab Estate / iPent Estate', lat: 8.9850, lng: 7.4550, context: 'Chronic flood zone, flagged by FEMA as flood-prone', thresholds: { watch: 0.39, warning: 0.49, critical: 0.83 } },
    { id: 'gaduwa-durumi', name: 'Gaduwa-Durumi Bridge', lat: 9.0120, lng: 7.4460, context: 'Bridge fully submerged, cut off movement', thresholds: { watch: 2.94, warning: 3.69, critical: 6.49 } },
    { id: 'lugbe', name: 'Lugbe - Trademore Estate', lat: 8.9750, lng: 7.3650, context: 'Worst-hit residential estate historically (2024–2026)', thresholds: { watch: 3.33, warning: 4.30, critical: 7.41 } },
    { id: 'kubwa', name: 'Kubwa', lat: 9.1583, lng: 7.3319, context: 'FEMA flood alert tied to Usuma Dam spillover', thresholds: { watch: 4.34, warning: 5.12, critical: 7.77 } },
    { id: 'katampe', name: 'Katampe', lat: 9.1050, lng: 7.4550, context: 'Flooded Aug 15, previously considered safe high ground', thresholds: { watch: 0.40, warning: 0.46, critical: 0.77 } },
    { id: 'mabushi', name: 'Mabushi', lat: 9.0850, lng: 7.4450, context: 'Flooded roads; FEMA visited as known flood-prone community', thresholds: { watch: 6.67, warning: 8.42, critical: 14.58 } },
    { id: 'gwarinpa', name: 'Gwarinpa', lat: 9.1100, lng: 7.4100, context: 'Roads submerged, commuters stranded', thresholds: { watch: 1.28, warning: 1.65, critical: 2.58 } },
    { id: 'asokoro', name: 'Asokoro', lat: 9.0430, lng: 7.5330, context: 'First flooding in recent history reported here (Aug 2026)', thresholds: { watch: 2.00, warning: 2.74, critical: 4.00 } },
    { id: 'maitama', name: 'Maitama', lat: 9.0850, lng: 7.4950, context: 'Flooded Aug 15, part of city-centre flooding', thresholds: { watch: 0.89, warning: 1.14, critical: 1.90 } },
    { id: 'utako', name: 'Utako', lat: 9.0700, lng: 7.4400, context: 'Waterlogged roads, traffic chaos', thresholds: { watch: 6.59, warning: 8.27, critical: 11.45 } },
    { id: 'wuye', name: 'Wuye', lat: 9.0600, lng: 7.4700, context: 'Flooded alongside Wuse/Gudu cluster', thresholds: { watch: 0.89, warning: 1.14, critical: 1.90 } },
    { id: 'galadimawa', name: 'Galadimawa', lat: 8.9950, lng: 7.4200, context: 'Long-standing flood-prone community per FCT Emergency Management', thresholds: { watch: 2.06, warning: 2.56, critical: 3.57 } },
    { id: 'nyanya', name: 'Nyanya', lat: 9.0350, lng: 7.5450, context: 'Repeated flooding in the same event cluster', thresholds: { watch: 2.00, warning: 2.74, critical: 4.00 } }
];

const RISK_LEVELS = ['normal', 'watch', 'warning', 'critical'];

const RISK_COLORS = {
    normal: '#4da6ff',
    watch: '#ffc107',
    warning: '#fd7e14',
    critical: '#dc3545'
};

const BADGE_TEXT = {
    normal: 'All Clear',
    watch: 'Flood Watch',
    warning: 'Flood Warning',
    critical: '⚠ FLOOD ALERT'
};

// GloFAS cells are 0.05°, so hotspots in the same cell share one request
const GLOFAS_CELL_DEG = 0.05;
const dischargeCache = new Map();

function fetchDischarge(lat, lng) {
    const key = `${Math.floor(lat / GLOFAS_CELL_DEG)},${Math.floor(lng / GLOFAS_CELL_DEG)}`;
    if (!dischargeCache.has(key)) {
        const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=7`;
        dischargeCache.set(key, fetch(url).then(response => {
            if (!response.ok) throw new Error(`Flood API responded ${response.status}`);
            return response.json();
        }).then(data => data.daily));
    }
    return dischargeCache.get(key);
}

function fetchAllGaugeData() {
    return Promise.all(FLOOD_GAUGES.map(async gauge => ({
        gauge,
        daily: await fetchDischarge(gauge.lat, gauge.lng)
    })));
}

function getRiskLevel(peak, thresholds) {
    if (peak >= thresholds.critical) return 'critical';
    if (peak >= thresholds.warning) return 'warning';
    if (peak >= thresholds.watch) return 'watch';
    return 'normal';
}

function updateRasterStyle(risk) {
    const pane = map.getPane('pane_PotentialFloodZones_1');
    pane.classList.remove(...RISK_LEVELS.map(level => `flood-${level}`));
    pane.classList.add(`flood-${risk}`);
}

function addGaugeMarker(gauge, daily, peak, risk) {
    const marker = L.circleMarker([gauge.lat, gauge.lng], {
        radius: 12,
        color: '#fff',
        weight: 2,
        fillColor: RISK_COLORS[risk],
        fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(`
        <h6 class="mb-1">${gauge.name}</h6>
        <small class="text-secondary">Context: ${gauge.context}</small>
        <hr class="my-2">
        <canvas id="chart-${gauge.id}" width="250" height="120"></canvas>
        <p class="small mt-2 mb-0">
            Peak discharge: <strong>${peak.toFixed(2)} m³/s</strong><br>
            Status: <strong class="text-capitalize" style="color: ${RISK_COLORS[risk]};">${risk}</strong>
        </p>
    `);

    // Dates come back as UTC days; format in UTC so viewers west of GMT don't see the previous weekday
    const labels = daily.time.map(day => new Date(day).toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' }));
    let chart;

    marker.on('popupopen', function () {
        chart = new Chart(document.getElementById(`chart-${gauge.id}`), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: daily.river_discharge,
                    borderColor: RISK_COLORS[risk],
                    backgroundColor: RISK_COLORS[risk] + '33',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'm³/s' } }
                }
            }
        });
    });

    // Leaflet rebuilds the popup's HTML on every open, so each open gets a fresh chart
    marker.on('popupclose', function () {
        chart.destroy();
    });
}

function updateStatusBadge(risk) {
    const badge = document.getElementById('floodStatusBadge');
    badge.textContent = BADGE_TEXT[risk];
    badge.style.background = RISK_COLORS[risk];
    document.getElementById('floodStatusDetail').textContent = 'Based on 7-day river discharge forecast via GloFAS.';
}

const floodLegend = L.control({ position: 'bottomright' });
floodLegend.onAdd = function () {
    const container = L.DomUtil.create('div', 'bg-white rounded-3 shadow px-3 py-2 small');
    container.innerHTML = RISK_LEVELS.map(level =>
        `<div><span style="color: ${RISK_COLORS[level]};">●</span> <span class="text-capitalize">${level}</span></div>`
    ).join('');
    return container;
};
floodLegend.addTo(map);

async function initFloodLayer() {
    try {
        const results = await fetchAllGaugeData();
        let overallRisk = 'normal';

        results.forEach(({ gauge, daily }) => {
            const peak = Math.max(...daily.river_discharge);
            const risk = getRiskLevel(peak, gauge.thresholds);
            if (RISK_LEVELS.indexOf(risk) > RISK_LEVELS.indexOf(overallRisk)) {
                overallRisk = risk;
            }
            addGaugeMarker(gauge, daily, peak, risk);
        });

        updateRasterStyle(overallRisk);
        updateStatusBadge(overallRisk);
    } catch (error) {
        console.error('Flood API error:', error);
        const badge = document.getElementById('floodStatusBadge');
        badge.textContent = 'Unavailable';
        badge.style.background = '#6c757d';
        document.getElementById('floodStatusDetail').textContent = 'Could not reach the river discharge forecast service.';
    }
}

initFloodLayer();
