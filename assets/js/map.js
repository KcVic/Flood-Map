var map = L.map('map', {
    zoomControl:false, maxZoom:28, minZoom:1
}).setView([9.0765, 7.3986], 12);


var hash = new L.Hash(map);
map.attributionControl.setPrefix('<a href="https://github.com/tomchadwin/qgis2web" target="_blank">qgis2web</a> &middot; <a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> &middot; <a href="https://qgis.org">QGIS</a>');
var autolinker = new Autolinker({truncate: {length: 30, location: 'smart'}});
// remove popup's row if "visible-with-data"
function removeEmptyRowsFromPopupContent(content, feature) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    var rows = tempDiv.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
        var td = rows[i].querySelector('td.visible-with-data');
        var key = td ? td.id : '';
        if (td && td.classList.contains('visible-with-data') && feature.properties[key] == null) {
            rows[i].parentNode.removeChild(rows[i]);
        }
    }
    return tempDiv.innerHTML;
}
// modify popup if contains media
function addClassToPopupIfMedia(content, popup) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    var imgTd = tempDiv.querySelector('td img');
    if (imgTd) {
        var src = imgTd.getAttribute('src');
        if (/\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i.test(src)) {
            popup._contentNode.classList.add('media');
            setTimeout(function() {
                popup.update();
            }, 10);
        } else if (/\.(mp3|wav|ogg|aac)$/i.test(src)) {
            var audio = document.createElement('audio');
            audio.controls = true;
            audio.src = src;
            imgTd.parentNode.replaceChild(audio, imgTd);
            popup._contentNode.classList.add('media');
            setTimeout(function() {
                popup.setContent(tempDiv.innerHTML);
                popup.update();
            }, 10);
        } else if (/\.(mp4|webm|ogg|mov)$/i.test(src)) {
            var video = document.createElement('video');
            video.controls = true;
            video.src = src;
            video.style.width = "400px";
            video.style.height = "300px";
            video.style.maxHeight = "60vh";
            video.style.maxWidth = "60vw";
            imgTd.parentNode.replaceChild(video, imgTd);
            popup._contentNode.classList.add('media');
            // Aggiorna il popup quando il video carica i metadati
            video.addEventListener('loadedmetadata', function() {
                popup.update();
            });
            setTimeout(function() {
                popup.setContent(tempDiv.innerHTML);
                popup.update();
            }, 10);
        } else {
            popup._contentNode.classList.remove('media');
        }
    } else {
        popup._contentNode.classList.remove('media');
    }
}
var zoomControl = L.control.zoom({
    position: 'bottomleft'
}).addTo(map);


var locateControl = L.control({position: 'bottomleft'});
locateControl.onAdd = function () {
    var container = L.DomUtil.create('div', 'leaflet-control locate-control');
    container.appendChild(document.getElementById('locateBtn'));
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
};
locateControl.addTo(map);
var bounds_group = new L.featureGroup([]);
map.createPane('pane_GoogleHybrid_0');
map.getPane('pane_GoogleHybrid_0').style.zIndex = 400;
var MAPTILER_KEY = CONFIG.MAPTILER_KEY;
var MAPTILER_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

var layer_GoogleHybrid_0 = L.tileLayer('https://api.maptiler.com/maps/hybrid-v4/{z}/{x}/{y}.jpg?key=' + MAPTILER_KEY, {
    pane: 'pane_GoogleHybrid_0',
    opacity: 1.0,
    attribution: MAPTILER_ATTRIBUTION,
    tileSize: 512,
    zoomOffset: -1,
    crossOrigin: true,
    minZoom: 1,
    maxZoom: 28,
    minNativeZoom: 0,
    maxNativeZoom: 20
});


var layer_Openstreet_0 = L.tileLayer('https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.png?key=' + MAPTILER_KEY, {
    attribution: MAPTILER_ATTRIBUTION,
    tileSize: 512,
    zoomOffset: -1,
    crossOrigin: true,
    minZoom: 1,
    maxZoom: 28,
    minNativeZoom: 0,
    maxNativeZoom: 20
});
map.addLayer(layer_GoogleHybrid_0);
map.createPane('pane_PotentialFloodZones_1');
map.getPane('pane_PotentialFloodZones_1').style.zIndex = 401;
var img_PotentialFloodZones_1 = 'qgis2web/data/PotentialFloodZones_1.png';
var img_bounds_PotentialFloodZones_1 = [[8.413623344832985,6.768852694940525],[9.41374952779199,7.730565409630858]];
var layer_PotentialFloodZones_1 = new L.imageOverlay(img_PotentialFloodZones_1,
                                        img_bounds_PotentialFloodZones_1,
                                        {pane: 'pane_PotentialFloodZones_1'});
bounds_group.addLayer(layer_PotentialFloodZones_1);
map.addLayer(layer_PotentialFloodZones_1);


// Location search
// The main box searches place names with the MapTiler Geocoding API (same key as the tiles).
// The arrow opens a second box for Google Maps links, which gmaps-url.js reads locally with no API call.
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const linkToggle = document.getElementById('linkToggle');
const linkPanel = document.getElementById('linkPanel');
const linkInput = document.getElementById('linkInput');
const linkBtn = document.getElementById('linkBtn');
const linkHint = document.getElementById('linkHint');

const DEFAULT_PLACEHOLDER = searchInput.placeholder;
const DEFAULT_LINK_HINT = linkHint.textContent;
const ABUJA_CENTRE = [7.4951, 9.0579];   // lng, lat: biases MapTiler results towards Abuja
let placeholderTimer = null;
let searchInFlight = false;
let searchMarker = null;

// Show a short message in the empty search box, then put the normal hint back
function flashPlaceholder(message, ms) {
    searchInput.value = '';
    searchInput.placeholder = message;
    clearTimeout(placeholderTimer);
    placeholderTimer = setTimeout(() => {
        searchInput.placeholder = DEFAULT_PLACEHOLDER;
    }, ms || 2500);
}

function setLinkHint(message, isError) {
    linkHint.textContent = message || DEFAULT_LINK_HINT;
    linkHint.classList.toggle('is-error', !!isError);
}

function setLinkPanel(open) {
    linkPanel.hidden = !open;
    linkToggle.setAttribute('aria-expanded', String(open));
    if (open) {
        setLinkHint();
        linkInput.focus();
    }
}

// result: { lat, lng, zoom?, bounds?, label?, inputText? }
function showSearchResult(result) {
    if (result.bounds) {
        map.flyToBounds(result.bounds, { maxZoom: 16, duration: 1.5 });
    } else {
        map.flyTo([result.lat, result.lng], result.zoom || 16, { duration: 1.5 });
    }

    if (searchMarker) {
        map.removeLayer(searchMarker);
    }
    searchMarker = L.marker([result.lat, result.lng]).addTo(map);

    const coordsText = `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`;
    const tooltip = document.createElement('span');
    tooltip.textContent = result.label || coordsText;   // textContent: names from pasted links are untrusted
    searchMarker.bindTooltip(tooltip, { direction: 'top', offset: [-15, -28] });

    clearTimeout(placeholderTimer);
    searchInput.placeholder = DEFAULT_PLACEHOLDER;
    searchInput.value = result.inputText || result.label || coordsText;
}

// MapTiler Geocoding. Typed searches are kept to Nigeria and biased towards Abuja; names taken
// from a Google Maps link are searched without limits, since the link may point anywhere.
// Returns { lat, lng, bounds, label } or null.
async function geocode(query, scopeToAbuja) {
    const params = new URLSearchParams({ key: MAPTILER_KEY, limit: '1', language: 'en' });
    if (scopeToAbuja) {
        params.set('country', 'ng');
        params.set('proximity', ABUJA_CENTRE.join(','));
    }
    // ';' separates batch queries in the MapTiler API, so keep it out of a single search
    const path = encodeURIComponent(query.replace(/;/g, ' '));
    const response = await fetch(`https://api.maptiler.com/geocoding/${path}.json?${params}`);
    if (!response.ok) throw new Error(`MapTiler geocoding returned ${response.status}`);

    const feature = (await response.json()).features[0];
    if (!feature) return null;

    const [lng, lat] = feature.center;
    const b = feature.bbox;   // [west, south, east, north]; a single point for addresses and POIs
    const hasArea = b && (b[0] !== b[2] || b[1] !== b[3]);
    return {
        lat: lat,
        lng: lng,
        bounds: hasArea ? [[b[1], b[0]], [b[3], b[2]]] : null,
        label: feature.place_name || feature.text || query
    };
}

async function performSearch() {
    const input = searchInput.value.trim();
    if (!input || searchInFlight) return;

    const parsed = parseSearchInput(input);
    const isLink = /^https?:|google\.|goo\.gl/i.test(input);

    // Typed "lat, lng" goes straight there
    if (parsed && !isLink) {
        showSearchResult(parsed);
        return;
    }
    // A link pasted into the main box is handed to the link box, which explains any problem with it
    if (parsed) {
        searchInput.value = '';
        linkInput.value = input;
        setLinkPanel(true);
        handleLink();
        return;
    }

    searchInFlight = true;
    clearTimeout(placeholderTimer);
    searchInput.value = '';
    searchInput.placeholder = 'Searching...';
    try {
        const hit = await geocode(input, true);
        if (hit) {
            hit.inputText = input;
            showSearchResult(hit);
        } else {
            flashPlaceholder('Location not found...');
        }
    } catch (error) {
        console.error('Search error:', error);
        flashPlaceholder('Error connecting...');
    } finally {
        searchInFlight = false;
    }
}

async function handleLink() {
    const text = linkInput.value.trim();
    if (!text || searchInFlight) return;

    const parsed = parseSearchInput(text);
    if (!parsed) {
        setLinkHint("That doesn't look like a Google Maps link.", true);
        return;
    }
    if (parsed.kind === 'shortlink') {
        setLinkHint("Short links (maps.app.goo.gl) can't be read. Open the link, then copy the full address from your browser.", true);
        return;
    }
    if (parsed.kind === 'unsupported') {
        setLinkHint("Couldn't find a location in that link.", true);
        return;
    }

    let result = parsed;
    if (parsed.kind === 'query') {
        // The link only names a place, so look the name up
        searchInFlight = true;
        setLinkHint('Searching...');
        try {
            result = await geocode(parsed.query, false);
        } catch (error) {
            console.error('Link search error:', error);
            setLinkHint('Error connecting. Please try again.', true);
            return;
        } finally {
            searchInFlight = false;
        }
        if (!result) {
            setLinkHint(`Couldn't find "${parsed.query}".`, true);
            return;
        }
        result.inputText = parsed.label;
    }

    showSearchResult(result);
    linkInput.value = '';
    setLinkPanel(false);
}

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') performSearch();
});

linkToggle.addEventListener('click', function () {
    setLinkPanel(linkPanel.hidden);
});
linkBtn.addEventListener('click', handleLink);
linkInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleLink();
    if (e.key === 'Escape') {
        setLinkPanel(false);
        linkToggle.focus();
    }
});
// Pasting a link goes straight there
linkInput.addEventListener('paste', function () {
    setTimeout(handleLink, 0);   // let the pasted text land in the box first
});
linkInput.addEventListener('input', function () {
    if (linkHint.classList.contains('is-error')) setLinkHint();
});

// Clicking anywhere outside the search area closes the link box
document.addEventListener('click', function (e) {
    if (!linkPanel.hidden && !e.target.closest('.search-wrap')) {
        setLinkPanel(false);
    }
});

// My location functionality
const locateBtn = document.getElementById('locateBtn');

locateBtn.addEventListener('click', function() {

    this.style.color = '#0d6efd';
    
    map.locate({setView: true, maxZoom: 20, duration: 1.5});
    
    setTimeout(() => {
        this.style.color = '#444';
    }, 2000);
});

// Event fired when user grants location access and it's found
map.on('locationfound', function(e) {
    if (searchMarker) {
        map.removeLayer(searchMarker);
    }
    // Add marker for current location
    searchMarker = L.marker(e.latlng).addTo(map);
    searchInput.value = "My Location";
});

// Event fired if location access fails or is denied
map.on('locationerror', function(e) {
    flashPlaceholder('Location access denied/failed...', 3000);
    console.error("Location error:", e.message);
});

// Layer switching functionality
const layerToggles = document.querySelectorAll('.layer-toggle');
layerToggles.forEach(button => {
    button.addEventListener('click', function() {
        const layer = this.getAttribute('data-layer');
        
        // Remove all active classes
        layerToggles.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        
        // Add active class to clicked button
        this.classList.remove('btn-outline-primary');
        this.classList.add('btn-primary');
        
        // Switch layers
        if (layer === 'google') {
            map.removeLayer(layer_Openstreet_0);
            map.addLayer(layer_GoogleHybrid_0);
        } else if (layer === 'openstreet') {
            map.removeLayer(layer_GoogleHybrid_0);
            map.addLayer(layer_Openstreet_0);
        }
    });
});

L.ImageOverlay.include({
    getBounds: function () {
        return this._bounds;
    }
});

// Sidebar collapse / expand
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function setSidebar(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
}

sidebarToggle.addEventListener('click', function () {
    setSidebar(!sidebar.classList.contains('collapsed'));
});

// Tapping the backdrop closes the drawer on small screens
sidebarBackdrop.addEventListener('click', function () {
    setSidebar(true);
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sidebar.classList.contains('collapsed') && window.innerWidth < 992) {
        setSidebar(true);
    }
});

// Keep Leaflet in sync once the width transition finishes
sidebar.addEventListener('transitionend', function (e) {
    if (e.propertyName === 'width') {
        map.invalidateSize();
    }
});

// Start closed on small screens so the map opens with the whole viewport to itself
if (window.matchMedia('(max-width: 991.98px)').matches) {
    setSidebar(true);
} else {
    sidebarToggle.setAttribute('aria-expanded', String(!sidebar.classList.contains('collapsed')));
}