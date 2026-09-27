# Contributing to the Abuja Flood Map

Welcome! We appreciate your interest in contributing to the Abuja Flood Map. This project relies on community knowledge to accurately map and track flood hotspots across the FCT.

Whether you are a GIS specialist, a software developer, or simply a resident who knows where flooding happens in your neighbourhood, you can contribute by adding new flood monitoring points to the system.

---

## Table of Contents

1. [Cloning & Local Setup](#1-cloning--local-setup)
2. [Configuring Your Map Tiles](#2-configuring-your-map-tiles)
3. [Understanding the Data Model](#3-understanding-the-data-model)
4. [Adding New Flood Hotspots](#4-adding-new-flood-hotspots)
5. [Submitting a Pull Request](#5-submitting-a-pull-request)

---

## 1. Cloning & Local Setup

Because this project fetches data from a local JSON file (`data/flood-gauges.json`) using JavaScript's `fetch()` API, you **cannot** simply double-click `index.html` to open it. Browsers block `fetch()` requests to local files for security reasons (this is called the CORS policy). You must serve the project through a local web server.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/abuja-flood-map.git
cd abuja-flood-map
```

### Step 2: Start a Local Server

**Option A — Python (built into most systems):**
```bash
python -m http.server 8000
```

**Option B — VS Code Live Server:**
1. Install the "Live Server" extension from the VS Code marketplace
2. Right-click `index.html` → "Open with Live Server"
3. The map opens automatically in your default browser

### Step 3: Open in Browser

Navigate to:
```
http://localhost:8000
```

You should see the Leaflet map with the blue HAND flood zones. If the map tiles are grey/missing, you need to configure your own MapTiler key (see Section 2 below).

---

## 2. Configuring Your Map Tiles

The live site uses a domain-restricted MapTiler API key that only works on `abujafloodmap.online`. When you run the project locally, the map tiles won't load because MapTiler rejects requests from `localhost` using that key.

To fix this, you need your own (free) key.

### Step 1: Get a Free MapTiler API Key

1. Go to [MapTiler Cloud](https://www.maptiler.com/cloud/) and sign up for a free account
2. Once logged in, go to your **API Keys** section
3. Copy your API key

### Step 2: Create Your Config File

1. Navigate to `assets/js/`
2. You will see a file called `config.example.js`. Copy it and rename the copy to `config.js`:
   ```bash
   cp assets/js/config.example.js assets/js/config.js
   ```
3. Open `config.js` in a text editor and replace the placeholder with your real key:
   ```javascript
   const CONFIG = {
       MAPTILER_KEY: 'paste_your_real_key_here'
   };
   ```
4. Save the file. Refresh the browser. The satellite and street tiles should now load.

### Step 3: Secure Your Key (Optional but Recommended)

In your MapTiler dashboard, navigate to the settings for your API key and add `localhost` and `127.0.0.1` to the "Allowed HTTP Origins" list. This ensures your key can only be used from your local machine and not by anyone else who might see it.

---

## 3. Understanding the Data Model

Before adding a new hotspot, it helps to understand how the system works.

### The JSON File

All flood monitoring points are stored in a single file: **`data/flood-gauges.json`**. This file is a simple JSON array of objects. Each object represents one flood-prone location.

Here is an example entry:

```json
{
    "id": "lugbe",
    "name": "Lugbe - Trademore Estate",
    "lat": 8.9750,
    "lng": 7.3650,
    "context": "Worst-hit residential estate historically (2024–2026)",
    "thresholds": { "watch": 15.35, "warning": 21.79, "critical": 30.14 }
}
```

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | string | A unique, URL-safe identifier (lowercase, hyphens allowed, no spaces) |
| `name` | string | Human-readable location name shown in the map popup |
| `lat` | number | Latitude in decimal degrees (e.g. `9.0765` for 9.0765° N) |
| `lng` | number | Longitude in decimal degrees (e.g. `7.4837` for 7.4837° E) |
| `context` | string | A brief sentence of historical flood context (shown in the popup below the chart) |
| `thresholds.watch` | number | River discharge (m³/s) that triggers a yellow "Flood Watch" alert |
| `thresholds.warning` | number | River discharge (m³/s) that triggers an orange "Flood Warning" alert |
| `thresholds.critical` | number | River discharge (m³/s) that triggers a red "Flood Alert" |

### What Happens Automatically

When you add a new entry to this JSON file, the JavaScript engine (`flood-api.js`) will automatically:

1. ✅ Fetch the 7-day river discharge forecast from Open-Meteo for that coordinate
2. ✅ Calculate the surge factor (today's flow vs. the 7-day peak)
3. ✅ Determine the risk level using the hybrid model (absolute thresholds + surge detection)
4. ✅ Place a colour-coded circle marker on the map
5. ✅ Generate a Chart.js popup with the 7-day forecast graph
6. ✅ Include the location in the overall raster pulsing logic

You do **not** need to write any JavaScript.

---

## 4. Adding New Flood Hotspots

### Step 4a: Get the Coordinates

1. Open [Google Maps](https://maps.google.com)
2. Navigate to the flood-prone location
3. Right-click on the exact spot
4. The first option in the context menu shows the latitude and longitude (e.g. `9.0765, 7.4837`)
5. Click to copy them

### Step 4b: Calculate the Thresholds

This is the most important step. If your thresholds are too low, the map will constantly show false alarms. If they are too high, it will never warn anyone.

Our model uses the **Open-Meteo GloFAS API**, which reports river discharge in **cubic metres per second (m³/s)**. We classify risk using statistical **Return Periods**:

- **Watch** threshold = the discharge level of a flood that typically occurs every **2 years**
- **Warning** threshold = the discharge level of a flood that typically occurs every **5 years**
- **Critical** threshold = the discharge level of a flood that typically occurs every **20 years**

#### Method 1: The Excel/Spreadsheet Method (Recommended for Novices)

This is the simplest way. No statistics knowledge required.

1. Go to the [Open-Meteo Historical Flood API playground](https://open-meteo.com/en/docs/flood-api#section/Parameter)
2. Enter your **Latitude** and **Longitude** in the input boxes
3. Set the **Start Date** to `1997-01-01`
4. Set the **End Date** to today's date (e.g. `2026-09-27`)
5. Make sure **"Daily: River Discharge"** is checked
6. Scroll down and click **"Download CSV"**

You now have a CSV file with roughly 10,000 rows — one row per day for the last ~30 years of simulated river flow at that location.

7. Open the CSV in **Excel** or **Google Sheets**
8. Sort the `river_discharge` column from **Highest to Lowest** (descending)
9. Now use this simple rule to pick your thresholds:

   | Threshold | Which row to look at | Why |
   |:----------|:---------------------|:----|
   | **Critical** | The **2nd highest** value in the entire column | In ~30 years of data, this flood magnitude has only happened once or twice. It represents a ~20-year return period. |
   | **Warning** | The **5th or 6th highest** value | This magnitude occurs roughly every 5 years, so you'd see it 5–6 times in 30 years. |
   | **Watch** | The **12th to 15th highest** value | This magnitude occurs roughly every 2 years, so you'd see it about 12–15 times in 30 years. |

10. Round the numbers to 2 decimal places and use them as your thresholds.

**Example:**
If the sorted discharge values start with: `32.5, 30.1, 28.7, 24.3, 21.8, 20.9, 19.2, 18.1, 16.5, 15.8, 15.4, 15.3, 14.9, 14.2, ...`

Then:
- Critical = `30.14` (2nd highest)
- Warning = `21.79` (5th highest)
- Watch = `15.35` (12th highest)

#### Method 2: Copy from the Nearest Existing Gauge

If your new location is very close to an existing gauge (within 2–3 km and in the same river basin), you can copy that gauge's thresholds as a starting point. The GloFAS model uses a 5km grid, so nearby locations on the same stream will have similar discharge patterns.

Open `data/flood-gauges.json`, find the nearest existing gauge, and use its thresholds.

#### Method 3: Statistical Fitting (For GIS/Hydrology Specialists)

If you have experience with extreme value statistics, you can fit a **Gumbel distribution** (Type I Generalized Extreme Value) to the annual maxima series extracted from the GloFAS reanalysis. The thresholds correspond to:
- Watch = 2-year return period quantile
- Warning = 5-year return period quantile
- Critical = 20-year return period quantile

### Step 4c: Add Your Entry to the JSON

Open `data/flood-gauges.json` in any text editor. The file is a JSON array (starts with `[` and ends with `]`). Add your new entry at the bottom, **before the closing `]`**.

**Important formatting rules:**
- Add a comma `,` after the `}` of the previous (last) entry
- Do NOT add a comma after your new entry's closing `}` (it's now the last item)
- Make sure all strings are in double quotes (`"`), not single quotes
- Make sure `lat` and `lng` are numbers (no quotes)

**Before (last entry in the file):**
```json
    {
        "id": "nyanya",
        "name": "Nyanya",
        "lat": 9.0350,
        "lng": 7.5450,
        "context": "Repeated flooding in the same event cluster",
        "thresholds": { "watch": 10.47, "warning": 15.15, "critical": 21.23 }
    }
]
```

**After (your new entry added):**
```json
    {
        "id": "nyanya",
        "name": "Nyanya",
        "lat": 9.0350,
        "lng": 7.5450,
        "context": "Repeated flooding in the same event cluster",
        "thresholds": { "watch": 10.47, "warning": 15.15, "critical": 21.23 }
    },
    {
        "id": "jabi-lake",
        "name": "Jabi Lake Outflow",
        "lat": 9.0710,
        "lng": 7.4220,
        "context": "Known overflow zone during peak rainy season",
        "thresholds": { "watch": 10.5, "warning": 15.2, "critical": 22.0 }
    }
]
```

### Step 4d: Test It

1. Save the file
2. Refresh your local server (`http://localhost:8000`)
3. You should see a new green circle marker at your location
4. Click it — a popup should open with the 7-day discharge chart
5. Check the browser console (F12 → Console) for any errors

If the marker doesn't appear, the most common issue is invalid JSON. Paste your `flood-gauges.json` content into [jsonlint.com](https://jsonlint.com/) to validate it.

---

## 5. Submitting a Pull Request

1. **Fork** the repository on GitHub
2. **Create a new branch** for your change:
   ```bash
   git checkout -b add-jabi-hotspot
   ```
3. **Commit your changes** with a clear message:
   ```bash
   git add data/flood-gauges.json
   git commit -m "Add Jabi Lake flood gauge (known overflow zone)"
   ```
4. **Push to your fork**:
   ```bash
   git push origin add-jabi-hotspot
   ```
5. **Open a Pull Request** on GitHub

### What to Include in Your PR Description

Please include:
- **Why** this location is a known flood risk (news articles, personal experience, FEMA reports, etc.)
- **How** you calculated the thresholds (which method from Section 4b)
- **A screenshot** of the new marker on the map (optional but helpful)

### What We Check During Review

- Is the JSON valid? (no missing commas, no trailing commas)
- Is the `id` unique and URL-safe?
- Are the coordinates accurate? (we'll verify on Google Maps)
- Are the thresholds reasonable? (not wildly different from nearby gauges on the same river)
- Does the `context` field provide useful historical information?
