// Live river discharge forecasts (Open-Meteo Flood API / GloFAS) for Abuja flood hotspots.
// Loads after map.js, which provides the globals `map` and the pane_PotentialFloodZones_1 pane.

// Thresholds are GloFAS-convention return periods — watch = 2-year flood, warning = 5-year,
// critical = 20-year — from a Gumbel fit to the annual maxima of the 1997–2024 GloFAS
// reanalysis for each hotspot's grid cell. Hotspots sharing a 0.05° cell share thresholds.
const FLOOD_GAUGES = [
    { id: 'wuse2', name: 'Wuse 2 - Adetokunbo Ademola Crescent', lat: 9.0765, lng: 7.4837, context: 'Cars submerged, businesses closed (Aug 15 flood)', thresholds: { watch: 4.68, warning: 6.93, critical: 9.85 } },
    { id: 'gudu', name: 'Gudu - Delight Event Centre / Ebeano-Gudu Rd', lat: 9.0270, lng: 7.4610, context: 'Heavy rainfall triggered flash flooding on 15th August 2026', thresholds: { watch: 7.23, warning: 10.42, critical: 14.55 } },
    { id: 'lokogoma', name: 'Lokogoma - Efab Estate / iPent Estate', lat: 8.9850, lng: 7.4550, context: 'Chronic flood zone, flagged by FEMA as flood-prone', thresholds: { watch: 2.0, warning: 2.82, critical: 3.87 } },
    { id: 'gaduwa-durumi', name: 'Gaduwa-Durumi Bridge', lat: 9.0120, lng: 7.4460, context: 'Bridge fully submerged, cut off movement on August 15, 2026', thresholds: { watch: 13.24, warning: 19.28, critical: 27.1 } },
    { id: 'lugbe', name: 'Lugbe - Trademore Estate', lat: 8.9750, lng: 7.3650, context: 'Worst-hit residential estate historically (2024–2026)', thresholds: { watch: 15.35, warning: 21.79, critical: 30.14 } },
    { id: 'kubwa', name: 'Kubwa', lat: 9.1583, lng: 7.3319, context: 'FEMA flood alert tied to Usuma Dam spillover', thresholds: { watch: 20.98, warning: 32.75, critical: 48.02 } },
    { id: 'katampe', name: 'Katampe', lat: 9.1050, lng: 7.4550, context: 'Flooded Aug 15, previously considered safe high ground', thresholds: { watch: 2.27, warning: 3.47, critical: 5.03 } },
    { id: 'mabushi', name: 'Mabushi', lat: 9.0850, lng: 7.4450, context: 'Flooded roads; FEMA visited as known flood-prone community', thresholds: { watch: 30.95, warning: 45.44, critical: 64.25 } },
    { id: 'gwarinpa', name: 'Gwarinpa', lat: 9.1100, lng: 7.4100, context: 'Roads submerged, commuters stranded', thresholds: { watch: 6.27, warning: 9.45, critical: 13.58 } },
    { id: 'asokoro', name: 'Asokoro', lat: 9.0430, lng: 7.5330, context: 'First flooding in recent history reported here (Aug 2026)', thresholds: { watch: 10.47, warning: 15.15, critical: 21.23 } },
    { id: 'maitama', name: 'Maitama', lat: 9.0850, lng: 7.4950, context: 'Flooded Aug 15, part of city-centre flooding', thresholds: { watch: 4.68, warning: 6.93, critical: 9.85 } },
    { id: 'utako', name: 'Utako', lat: 9.0700, lng: 7.4400, context: 'Waterlogged roads, traffic chaos', thresholds: { watch: 30.95, warning: 45.44, critical: 64.25 } },
    { id: 'wuye', name: 'Wuye', lat: 9.0600, lng: 7.4700, context: 'Flooded alongside Wuse/Gudu cluster', thresholds: { watch: 4.68, warning: 6.93, critical: 9.85 } },
    { id: 'galadimawa', name: 'Galadimawa', lat: 8.9950, lng: 7.4200, context: 'Long-standing flood-prone community per FCT Emergency Management', thresholds: { watch: 9.57, warning: 13.65, critical: 18.93 } },
    { id: 'nyanya', name: 'Nyanya', lat: 9.0350, lng: 7.5450, context: 'Repeated flooding in the same event cluster', thresholds: { watch: 10.47, warning: 15.15, critical: 21.23 } }
];

const RISK_LEVELS = ['normal', 'watch', 'warning', 'critical'];

const RISK_COLORS = {
    normal: '#51c12f',
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

// A stream can be dangerous well below its historical flood level if it rises sharply,
// so the peak is read against both the absolute thresholds and today's flow.
function surgeStats(dischargeArr) {
    const peak = Math.max(...dischargeArr);
    const baseline = dischargeArr[0];
    return { peak, baseline, surgeFactor: peak / Math.max(baseline, 0.01) };
}

function getRiskLevel(dailyData, thresholds) {
    const { peak, surgeFactor } = surgeStats(dailyData.river_discharge);

    if (peak >= thresholds.critical) return 'critical';
    if (peak >= thresholds.warning || (surgeFactor >= 4.0 && peak >= thresholds.watch * 0.5)) {
        return 'warning';
    }
    if (peak >= thresholds.watch || (surgeFactor >= 2.5 && peak >= thresholds.watch * 0.3)) {
        return 'watch';
    }
    return 'normal';
}

// ── Localised raster pulse ──
const PULSE_RADIUS_KM = 5;
const PULSE_PANE = 'pane_FloodPulse';

map.createPane(PULSE_PANE);
map.getPane(PULSE_PANE).style.zIndex = 402;

let pulseOverlays = [];

function gaugeHalo(gauge) {
    const [[south, west], [north, east]] = img_bounds_PotentialFloodZones_1;
    const lonKm = (east - west) * 111.320 * Math.cos((south + north) / 2 * Math.PI / 180);
    const latKm = (north - south) * 110.574;
    return {
        fx: (gauge.lng - west) / (east - west) * 100,
        fy: (north - gauge.lat) / (north - south) * 100,
        rx: PULSE_RADIUS_KM / lonKm * 100,
        ry: PULSE_RADIUS_KM / latKm * 100
    };
}

function haloGradient(gauge, kind) {
    const { fx, fy, rx, ry } = gaugeHalo(gauge);
    const stops = kind === 'hole' ? 'transparent 55%, #000 100%' : '#000 55%, transparent 100%';
    return `radial-gradient(ellipse ${rx.toFixed(3)}% ${ry.toFixed(3)}% at ${fx.toFixed(3)}% ${fy.toFixed(3)}%, ${stops})`;
}

function applyMask(el, layers, composite) {
    el.style.maskImage = el.style.webkitMaskImage = layers;
    el.style.maskComposite = composite;
}

function updateRasterStyle(assessed) {
    const elevated = assessed.filter(a => a.risk !== 'normal');
    const baseImg = layer_PotentialFloodZones_1.getElement();

    pulseOverlays.forEach(overlay => map.removeLayer(overlay));
    pulseOverlays = [];

    if (!elevated.length) {
        applyMask(baseImg, '', '');
        return;
    }

    // 'intersect' so each gauge subtracts its own hole rather than the holes cancelling out
    applyMask(baseImg, elevated.map(a => haloGradient(a.gauge, 'hole')).join(', '), 'intersect');

    RISK_LEVELS.filter(level => elevated.some(a => a.risk === level)).forEach(level => {
        const overlay = new L.ImageOverlay(img_PotentialFloodZones_1, img_bounds_PotentialFloodZones_1, {
            pane: PULSE_PANE,
            className: `flood-pulse flood-${level}`
        }).addTo(map);
        const spots = elevated.filter(a => a.risk === level).map(a => haloGradient(a.gauge, 'spot'));
        applyMask(overlay.getElement(), spots.join(', '), 'add');
        pulseOverlays.push(overlay);
    });
}

function addGaugeMarker(gauge, daily, risk) {
    const { peak, baseline, surgeFactor } = surgeStats(daily.river_discharge);
    const risePct = (surgeFactor - 1) * 100;

    const marker = L.circleMarker([gauge.lat, gauge.lng], {
        radius: 12,
        color: '#fff',
        weight: 2,
        fillColor: RISK_COLORS[risk],
        fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(`
        <h6 class="mb-1">${gauge.name}</h6>
        <small class="text-secondary">Historical Context: ${gauge.context}</small>
        <hr class="my-2">
        <canvas id="chart-${gauge.id}" width="250" height="120"></canvas>
        <p class="small mt-2 mb-0">
            Current: ${baseline.toFixed(2)} m³/s<br>
            Peak forecast: <strong>${peak.toFixed(2)} m³/s</strong>
            <span class="text-muted">(${risePct >= 0 ? '+' : ''}${risePct.toFixed(0)}%)</span><br>
            Status: <strong class="text-capitalize" style="color: ${RISK_COLORS[risk]};">${risk}</strong>
        </p>
    `, {
        // Keep popups clear of the search/layer bar over the top of the map (up to ~120px tall on phones)
        autoPanPaddingTopLeft: [5, 125]
    });

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
        const assessed = results.map(({ gauge, daily }) => ({
            gauge,
            daily,
            risk: getRiskLevel(daily, gauge.thresholds)
        }));

        let overallRisk = 'normal';
        assessed.forEach(({ gauge, daily, risk }) => {
            if (RISK_LEVELS.indexOf(risk) > RISK_LEVELS.indexOf(overallRisk)) {
                overallRisk = risk;
            }
            addGaugeMarker(gauge, daily, risk);
        });

        updateRasterStyle(assessed);
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
