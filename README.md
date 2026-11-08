# Abuja Flood Risk Interactive Map

An open-source, interactive web-based mapping application that identifies and actively monitors high-risk flood zones in Abuja, Nigeria.

The project combines two systems:
1. **Static Inundation Mapping** — A terrain analysis (HAND) that identifies every location in Abuja that sits less than 2 metres above the nearest river or stream, and therefore could be submerged during a flood.
2. **Live River Discharge Monitoring** — A JavaScript engine that queries the Open-Meteo Flood API every time the page loads to pull a 7-day forecast of river flow for 15 calibrated flood hotspots across the FCT. It uses a hybrid model to detect both historically catastrophic floods AND sudden surges in water level.

---

## 🗺️ Features

- **Interactive Map Visualization**: Explore flood risk zones across Abuja with an intuitive Leaflet-based interface
- **Live River Discharge Forecasts**: 7-day future predictions for 15 historically calibrated flood hotspots via the Open-Meteo GloFAS API
- **Dynamic Raster Pulsing**: The static HAND inundation map breathes/pulses visually in a 5km halo around any gauge where the river is surging — other areas of the map stay calm
- **Hybrid Surge Detection**: Flags locations using both absolute historical thresholds AND relative rate-of-change (a sudden 2.5× or 4× spike in discharge)
- **Dual Base Map Layers**: Toggle between Google Hybrid (satellite imagery) and OpenStreetMap layers
- **Location Search**: Search for any location in Abuja and instantly navigate to it with MapTiler geocoding. The arrow beside the search bar opens a box for pasting a full Google Maps link; the coordinates are read straight from the link, with no API call
- **My Location Feature**: Automatically locate your current position and place a marker on the map
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices
- **Bootstrap-Powered UI**: Built with Bootstrap 5 for clean, modern styling with glass-morphism effects
- **Chart.js Popups**: Clicking any gauge marker opens a popup with a 7-day discharge line chart, current flow, peak forecast, percentage rise, and historical context

---

## 🛠️ Technologies Used

### Frontend
- **Leaflet.js** — Interactive mapping library
- **Chart.js** — Interactive charts inside map popups
- **Bootstrap 5.3.3** — Responsive CSS framework
- **Google Fonts (Inter)** — Typography
- **FontAwesome** — Icon library
- **Vanilla JavaScript** — All interactivity, no build tools or frameworks

### GIS & Spatial Analysis
- **QGIS 3** — Desktop GIS software for spatial analysis
- **WhiteboxTools** — Hydrological analysis engine (Fill Depressions, Flow Accumulation, Stream Extraction, HAND)
- **qgis2web** — Plugin to export QGIS projects as Leaflet web maps

### APIs
- **Open-Meteo Flood API** — Live 7-day GloFAS river discharge forecasts (free, no key required)
- **MapTiler API** — Satellite and street tile layers, plus place search (free tier, key required)
- **Browser Geolocation API** — Native "Find My Location" feature

### Data Sources
- **SRTM Digital Elevation Model (DEM)** — Terrain data for Abuja
- **GloFAS Reanalysis (1997–2024)** — Historical river discharge data used to calibrate flood thresholds

---

## 🔬 Phase 1: Spatial Analysis — The HAND Technique

The base blue inundation layer visible on the map (`PotentialFloodZones_1.png`) was generated entirely offline using desktop GIS software. It does not change in real time. It represents every location in the FCT that is physically low enough to be submerged if the nearest river or stream overflows.

### What is HAND?

**HAND (Height Above Nearest Drainage)** is a terrain normalisation technique. Instead of measuring a location's absolute elevation above sea level (which doesn't tell you much about flood risk), HAND measures the **vertical distance from that location down to the nearest stream or river channel**.

For example:
- A point that is 500 metres above sea level but only 1.5 metres above the nearest stream is at **high flood risk** (HAND = 1.5m).
- A point that is 300 metres above sea level but 50 metres above the nearest stream is at **no flood risk** (HAND = 50m).

We threshold the HAND raster at **2.0 metres**: any cell with a HAND value ≤ 2m is classified as a potential flood zone and rendered in blue on the map.

### Why HAND and Not Just Elevation?

Raw elevation maps are misleading for flood analysis. A hilltop suburb at 400m elevation could be right next to a river valley — and therefore flood-prone — while a flat plain at 200m elevation might be far from any water source. HAND solves this by making every measurement **relative to the local drainage network**, not to sea level.

### Detailed QGIS Workflow (Using WhiteboxTools)

#### Required Plugins & Setup

Before beginning, install the following in QGIS:

- **WhiteboxTools for QGIS**: The core hydrological analysis engine.
  - Download the WhiteboxTools Open Core binary from [whiteboxgeo.com](https://www.whiteboxgeo.com/)
  - Point QGIS to the binary: **Settings → Options → Processing → Providers → WhiteboxTools** and set the path to the downloaded executable.
- **HAND Plugin** (optional): Simplifies the HAND calculation workflow into a single dialog.
- **QuickMapServices**: Adds basemap reference layers (Google Satellite, OpenStreetMap) so you can visually verify your results.

#### Data Requirements

- An SRTM DEM (Digital Elevation Model) covering Abuja. This can be downloaded from [USGS EarthExplorer](https://earthexplorer.usgs.gov/) or [OpenTopography](https://opentopography.org/).
- The DEM must be reprojected to a **projected coordinate system** before processing. We use **UTM Zone 32N (EPSG:32632)** because Abuja falls within this UTM zone. Projected coordinates are required because WhiteboxTools needs distances in metres, not degrees.

  To reproject in QGIS:
  1. Right-click the DEM layer → Export → Save Raster Layer As…
  2. Set the CRS to `EPSG:32632 — WGS 84 / UTM zone 32N`
  3. Save as `Abuja_SRTM_UTM32N.tif`

#### Step A: Hydrological Correction (Fill Depressions)

- **Tool**: WhiteboxTools → Hydrological Analysis → **Breach Depressions** (preferred) or **Fill Depressions**
- **Input**: `Abuja_SRTM_UTM32N.tif`
- **Output**: `Filled_DEM.tif`

**Why this step is necessary:**
Raw DEMs contain small artificial pits and sinks caused by measurement noise or rounding errors. These pits act like tiny bowls that trap water and prevent it from flowing downhill to the nearest stream. If you skip this step, the flow accumulation algorithm in Step B will produce a broken, disconnected drainage network with dead-end rivers.

"Breach Depressions" carves a narrow channel through the lowest rim of each pit so that trapped water can escape and continue flowing downstream. "Fill Depressions" does the opposite — it raises the pit floor up to the level of the rim. Both produce a "hydrologically corrected" DEM where water can flow continuously from any cell to the map edge.

**What was achieved:** A corrected DEM (`Filled_DEM.tif`) where every single cell has a valid downhill path to a stream outlet.

#### Step B: Flow Accumulation

- **Tool**: WhiteboxTools → Hydrological Analysis → **D8 Flow Accumulation**
- **Input**: `Filled_DEM.tif`
- **Parameters**: Leave "Log-transform" **unchecked** (we need raw cell counts for thresholding)
- **Output**: `Flow_Accum.tif`

**Why this step is necessary:**
To identify where streams and rivers are, we need to simulate how water flows across the terrain. The D8 ("Deterministic Eight-Node") algorithm looks at every cell in the DEM and determines which of its 8 neighbours is the steepest downhill direction. It then routes one unit of "virtual rainfall" from every cell downhill, accumulating the count as it goes.

Cells at the top of hills accumulate very little water (count ≈ 1). Cells at the bottom of valleys where thousands of uphill cells drain into them accumulate enormous counts (count ≈ 100,000+). These high-accumulation cells are where rivers and streams form.

**What was achieved:** A raster (`Flow_Accum.tif`) where every cell contains a number representing how many upstream cells drain through it. High values = rivers. Low values = hilltops.

#### Step C: Stream Network Extraction

- **Tool**: WhiteboxTools → Stream Network Analysis → **Extract Streams**
- **Input**: `Flow_Accum.tif`
- **Threshold**: Start with **1000 cells** (this is adjustable — see below)
- **Output**: `Stream_Network.tif` (binary raster: 1 = stream, 0 = land)

**Why this step is necessary:**
The flow accumulation raster is a continuous gradient — it doesn't tell you definitively "this cell IS a stream" vs "this cell is NOT a stream". We need a binary yes/no classification. The threshold parameter controls the cutoff:

- **Higher threshold (e.g. 5000)**: Only major rivers like the Usuma River and Gurara River are classified as streams. The HAND result will be coarser — only areas near large rivers will be flagged.
- **Lower threshold (e.g. 500)**: Small tributaries, seasonal channels, and even large drainage ditches are classified as streams. The HAND result will be more detailed — it will catch flooding from minor channels too, but may produce false positives in areas with insignificant drainage.

For Abuja, we used **1000 cells** as a balance: it captures the major rivers (Usuma, Jabi, Wupa) and their significant tributaries without picking up every tiny gully.

**What was achieved:** A binary raster (`Stream_Network.tif`) where every cell is either 1 (this cell is part of a stream/river channel) or 0 (this cell is dry land).

#### Step D: HAND Calculation (The Core Step)

- **Tool**: WhiteboxTools → Hydrological Analysis → **Elevation Above Stream**
- **Inputs**:
  - DEM: `Filled_DEM.tif`
  - Streams: `Stream_Network.tif`
- **Output**: `Abuja_HAND.tif`

**Why this step is necessary:**
This is the heart of the entire analysis. For every single cell in the DEM, the algorithm:
1. Traces the D8 flow path downhill from that cell until it hits a stream cell.
2. Records the **elevation of that stream cell**.
3. Subtracts the stream elevation from the cell's own elevation.
4. The result is the cell's HAND value — its vertical height above its nearest drainage channel.

For example, if a cell is at 450m elevation and the nearest stream it drains to is at 447m, the HAND value is 3.0 metres. If a cell is right next to a river at the same elevation, the HAND value is 0.0 metres.

**What was achieved:** A raster (`Abuja_HAND.tif`) where every cell contains a number in metres representing how far above the nearest river that cell sits. Low values (0–2m) = high flood risk. High values (10m+) = safe from river flooding.

#### Step E: Create the Final Flood Zone Map

- **Tool**: Raster → Raster Calculator
- **Formula**: `"Abuja_HAND@1" <= 2`
- **Output**: `Flood_Zones.tif` — A binary raster (1 = potential flood zone, 0 = safe)

**Why this step is necessary:**
The raw HAND raster is a continuous gradient of values (0m to 100m+). For the web map, we need a clear visual: "this area floods" vs "this area doesn't". The threshold of **2.0 metres** means: any location that sits 2 metres or less above its nearest stream is classified as a potential flood zone.

**Styling in QGIS:**
- In Layer Properties → Symbology, set the colour to a **blue ramp** with **50% transparency**
- This produces the distinctive blue overlay seen on the live map, where flooded zones are tinted blue and the satellite imagery underneath remains visible

**What was achieved:** A styled binary flood map ready for export to the web. Blue = at risk. Transparent = safe.

#### Step F: Export to Web Using qgis2web

1. **Install qgis2web plugin**: Plugins → Manage and Install Plugins → Search for "qgis2web" → Install
2. **Configure export**: Web → Export to Leaflet → Select layers to include → Configure base maps → Adjust zoom levels
3. **Export**: The plugin generates a self-contained folder of HTML, CSS, JavaScript, and image files that can be opened in any browser

The exported raster flood zone becomes `PotentialFloodZones_1.png` — a static image overlay positioned on the Leaflet map using `L.imageOverlay`.

#### Limitations & Considerations

- HAND assumes uniform rainfall distribution and constant drainage geometry — it does not model where rain actually falls
- Does not account for urban infrastructure (culverts, drainage pipes, concrete channels) that redirect water underground
- Actual flooding depends on rainfall intensity, duration, soil saturation, and drainage capacity
- Results are theoretical vulnerability assessments — the live discharge data in Phase 2 provides the real-time forecasting

---

## 🛰️ Phase 2: Live River Discharge — The Hybrid Surge Model

While Phase 1 answers "where COULD it flood?", Phase 2 answers "is it GOING to flood this week?".

The frontend script `assets/js/flood-api.js` runs every time the page loads. It queries the **Open-Meteo Flood API** to pull live GloFAS (Global Flood Awareness System) 7-day river discharge forecasts for 15 specific hotspots across the FCT.

### How the Data Flows

1. **On page load**, `flood-api.js` reads the list of 15 hotspots from `data/flood-gauges.json`
2. For each hotspot, it calls the Open-Meteo Flood API with the hotspot's lat/lng coordinates
3. The API returns an array of 7 numbers — one per day — representing the forecasted river discharge (in m³/s) at that grid cell
4. The script analyses each array to determine a risk level (`normal`, `watch`, `warning`, or `critical`)
5. It places a colour-coded circle marker on the map for each hotspot
6. If any hotspot is elevated above "normal", the static HAND raster pulses in a 5km halo around that specific gauge

### The GloFAS Grid Resolution

The GloFAS model operates on a **0.05° grid** (roughly 5km × 5km cells). This means several of the 15 hotspots may fall into the same grid cell and return the same forecast data. The script automatically deduplicates API calls using a cache keyed by grid cell:

```javascript
const GLOFAS_CELL_DEG = 0.05;
const dischargeCache = new Map();

function fetchDischarge(lat, lng) {
    // Round to the nearest 0.05° cell to avoid duplicate API calls
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
```

This reduces 15 hotspot lookups down to roughly 9 unique API calls.

### The Surge Calculation

The system compares today's baseline flow (the first element in the 7-day array) against the peak flow (the maximum value across all 7 days):

```javascript
function surgeStats(dischargeArr) {
    const peak = Math.max(...dischargeArr);      // Highest value in the 7-day forecast
    const baseline = dischargeArr[0];             // Today's current discharge

    // Calculate the multiplier:
    // If baseline is 0.5 m³/s and peak is 2.0 m³/s, surgeFactor = 4.0 (a 4× rise)
    // Math.max(baseline, 0.01) prevents dividing by zero if the river is completely dry
    return { peak, baseline, surgeFactor: peak / Math.max(baseline, 0.01) };
}
```

- A `surgeFactor` of `1.0` means no change — the river stays flat all week
- A `surgeFactor` of `2.5` means the peak is 2.5× today's flow — a significant swell
- A `surgeFactor` of `4.0` means the peak is 4× today's flow — a potential flash flood

### The Hybrid Risk Evaluation

A purely absolute model ("turn red at 30 m³/s") misses sudden surges that are dangerous but below the catastrophic threshold. A purely relative model ("turn red at any 4× spike") produces false alarms from tiny dry-season puddles. The hybrid model combines both:

```javascript
function getRiskLevel(dailyData, thresholds) {
    const { peak, surgeFactor } = surgeStats(dailyData.river_discharge);

    // CRITICAL: Only triggered by absolute threshold (the 20-year flood mark)
    // A critical alert should never be a false positive, so there is no surge path.
    if (peak >= thresholds.critical) return 'critical';

    // WARNING: Triggered by absolute threshold (5-year flood)
    //   OR by a massive 4× surge, BUT ONLY IF the peak volume is at least
    //   50% of the watch threshold (to filter out dry-season noise)
    if (peak >= thresholds.warning || (surgeFactor >= 4.0 && peak >= thresholds.watch * 0.5)) {
        return 'warning';
    }

    // WATCH: Triggered by absolute threshold (2-year flood)
    //   OR by a 2.5× surge, BUT ONLY IF the peak volume is at least
    //   30% of the watch threshold
    if (peak >= thresholds.watch || (surgeFactor >= 2.5 && peak >= thresholds.watch * 0.3)) {
        return 'watch';
    }

    return 'normal';
}
```

Each risk level has two independent paths to trigger:

| Level | Path A (Absolute) | Path B (Surge) |
|:------|:-------------------|:---------------|
| **Critical** | Peak ≥ 20-year flood threshold | No surge path (too risky for false positives) |
| **Warning** | Peak ≥ 5-year flood threshold | 4× surge AND peak ≥ 50% of watch threshold |
| **Watch** | Peak ≥ 2-year flood threshold | 2.5× surge AND peak ≥ 30% of watch threshold |

The "AND peak ≥ X% of watch threshold" clause is the **minimum volume floor**. It prevents the "dry season puddle" problem: if a stream goes from 0.01 m³/s to 0.04 m³/s (technically a 4× surge), it will NOT trigger a warning because 0.04 is nowhere near 50% of the watch threshold.

### Localised Raster Pulsing

When a gauge is elevated, the map doesn't turn the ENTIRE city red — only the area near the affected river. This is achieved using CSS `mask-image` with radial gradients.

The system creates two complementary masks:
- A **"hole"** mask is applied to the base raster, making it transparent in a 5km circle around the elevated gauge
- A **"spot"** mask is applied to a duplicate raster copy, making only the 5km circle visible. This copy has CSS `animation: pulse-flood` applied to it, causing it to breathe on and off

The two masks always add back up to the complete image, so no visual information is lost:

```javascript
function haloGradient(gauge, kind) {
    const { fx, fy, rx, ry } = gaugeHalo(gauge);
    // 'hole' = transparent in the centre, opaque outside (cuts the base image)
    // 'spot' = opaque in the centre, transparent outside (isolates the pulse area)
    const stops = kind === 'hole' ? 'transparent 55%, #000 100%' : '#000 55%, transparent 100%';
    return `radial-gradient(ellipse ${rx}% ${ry}% at ${fx}% ${fy}%, ${stops})`;
}
```

The pulse speed increases with severity:
```css
/* Watch: slow, gentle breathing (3 seconds) */
.flood-pulse { animation: pulse-flood 3s ease-in-out infinite; }

/* Warning: faster pulse (2 seconds) */
.flood-pulse.flood-warning  { animation-duration: 2s; }

/* Critical: urgent rapid pulse (1.2 seconds) */
.flood-pulse.flood-critical { animation-duration: 1.2s; }

@keyframes pulse-flood {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.2; }
}
```

### The Gauge Markers & Popups

Each hotspot gets a colour-coded circle marker. Clicking it opens a popup containing:
- The location name and historical flood context
- A **Chart.js line chart** showing the 7-day discharge forecast
- The current baseline discharge and the forecasted peak
- The percentage rise (e.g. "+300%")
- The risk status with colour coding

---

## 📁 Project Structure

```
mapping-projects/
├── index.html                      # Main HTML shell and UI
├── data/
│   └── flood-gauges.json           # The 15 calibrated flood hotspots (add new ones here!)
├── assets/
│   ├── css/
│   │   └── style.css               # All custom styling including flood pulse animations
│   ├── js/
│   │   ├── config.js               # MapTiler API key (domain-restricted)
│   │   ├── config.example.js       # Template for contributors to create their own config
│   │   ├── gmaps-url.js            # Reads coordinates from pasted Google Maps links
│   │   ├── map.js                  # Leaflet map init, layer toggles, search, geolocation
│   │   └── flood-api.js            # Live discharge engine: fetch, surge calc, markers, pulsing
│   └── images/                     # Logos, mockups, profile images
├── qgis2web/                       # Static assets exported from QGIS
│   ├── css/                        # Leaflet CSS + FontAwesome
│   ├── js/                         # Leaflet library + plugins
│   ├── data/                       # Raster overlay PNG (the blue HAND flood zones)
│   ├── legend/
│   ├── markers/
│   └── webfonts/
├── CONTRIBUTING.md                 # Guide for adding new flood hotspots
├── LICENSE                         # MIT License
├── README.md                       # This file
├── sitemap.xml                     # SEO sitemap
├── robots.txt                      # SEO robots
└── favicon.svg                     # Site icon
```

---

## 🚀 Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd mapping-projects
   ```

2. **Start a local server** (required because the app fetches `flood-gauges.json` at runtime):
   ```bash
   python -m http.server 8000
   ```
   *(Or use the "Live Server" extension in VS Code)*

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

> **Note:** The MapTiler API key included in `assets/js/config.js` is domain-restricted to `abujafloodmap.online`. If you fork the project and want to run it locally, see [CONTRIBUTING.md](CONTRIBUTING.md) for instructions on getting your own free key.

---

## 🔑 Key API Integrations

### Open-Meteo Flood API (GloFAS)
- **Endpoint**: `https://flood-api.open-meteo.com/v1/flood`
- **Usage**: 7-day river discharge forecasts
- **No API Key Required**: Free and open-source
- **Grid Resolution**: 0.05° (~5km)
- **Documentation**: [open-meteo.com/en/docs/flood-api](https://open-meteo.com/en/docs/flood-api)

### MapTiler
- **Usage**: Satellite hybrid and OpenStreetMap tile layers, and place search through the Geocoding API (`https://api.maptiler.com/geocoding/{query}.json`), limited to Nigeria and biased towards Abuja
- **API Key Required**: Free tier available at [maptiler.com](https://www.maptiler.com/cloud/)
- **Security**: Keys should be restricted to your domain in the MapTiler dashboard

### Browser Geolocation API
- **Browser Native**: Uses the browser's built-in geolocation
- **Privacy**: User must grant permission
- **Accuracy**: Varies by device (2–100m typical)

---

## 🤝 Contributing

We welcome contributions! Whether you are a GIS specialist, a developer, or a local resident who knows where flooding happens in Abuja, your help is appreciated.

Please read our [**Contributing Guide**](CONTRIBUTING.md) for detailed instructions on how to:
1. Clone the project and run a local server
2. Set up your own MapTiler API key
3. Calculate return period thresholds for a new location (step-by-step novice guide)
4. Add new flood hotspot entries to `data/flood-gauges.json`

---

## 🔧 Customization

### Change Study Area
- Export a different geographic region from QGIS using the same HAND workflow
- Update center coordinates in map initialization: `map.setView([latitude, longitude], zoomLevel)`

### Modify Base Maps
- In `map.js`: Edit tile layer URLs or add new providers (Stamen, CartoDB, etc.)
- Update layer toggle buttons in `index.html` to reflect new options

### Adjust Flood Threshold
- Change the HAND threshold (currently 2m) in QGIS Raster Calculator and re-export
- Adjust the surge multipliers (currently 2.5× and 4.0×) in `flood-api.js` if needed

### Add More Data Layers
- In QGIS: Add additional layers (population density, infrastructure, evacuation routes)
- Configure visibility in qgis2web export settings
- Add overlay controls in `map.js` for layer management

---

## 📚 Resources

- [Leaflet.js Documentation](https://leafletjs.com/)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [QGIS Documentation](https://docs.qgis.org/)
- [WhiteboxTools User Manual](https://www.whiteboxgeo.com/manual/wbt_book/intro.html)
- [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api)
- [qgis2web GitHub](https://github.com/tomchadwin/qgis2web)
- [MapTiler Geocoding API](https://docs.maptiler.com/cloud/api/geocoding/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

## 👤 Author

Created for flood risk assessment and geospatial visualization in Abuja, Nigeria.
