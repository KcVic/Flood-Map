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

// Find My Location control. Leaflet prepends into bottom corners, so adding this
// after the zoom control stacks it directly above the zoom buttons — no overlap.
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
var MAPTILER_KEY = 'oaJeDXhObRAHvJsE1TH7';
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
map.addLayer(layer_GoogleHybrid_0);

// Add OpenStreetMap tile layer
var layer_OSM_0 = L.tileLayer('https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.jpg?key=' + MAPTILER_KEY, {
    attribution: MAPTILER_ATTRIBUTION,
    tileSize: 512,
    zoomOffset: -1,
    crossOrigin: true,
    minZoom: 1,
    maxZoom: 28,
    minNativeZoom: 0,
    maxNativeZoom: 20
});
map.createPane('pane_PotentialFloodZones_1');
map.getPane('pane_PotentialFloodZones_1').style.zIndex = 401;
var img_PotentialFloodZones_1 = 'qgis2web/data/PotentialFloodZones_1.png';
var img_bounds_PotentialFloodZones_1 = [[8.413623344832985,6.768852694940525],[9.41374952779199,7.730565409630858]];
var layer_PotentialFloodZones_1 = new L.imageOverlay(img_PotentialFloodZones_1,
                                        img_bounds_PotentialFloodZones_1,
                                        {pane: 'pane_PotentialFloodZones_1'});
bounds_group.addLayer(layer_PotentialFloodZones_1);
map.addLayer(layer_PotentialFloodZones_1);


// Use OpenStreetMap's free Nominatim API for geocoding
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
let searchMarker = null;

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    // Use Nominatim (free, no API key needed)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Abuja, Nigeria')}&format=json&limit=1`;

    try {
        // Visual feedback during search
        const originalPlaceholder = searchInput.placeholder;
        searchInput.placeholder = "Searching...";
        const searchedQuery = searchInput.value;
        searchInput.value = "";

        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            // Fly to the new location
            map.flyTo([lat, lon], 15, {
                duration: 1.5
            });

            // Remove previous marker if it exists
            if (searchMarker) {
                map.removeLayer(searchMarker);
            }

            // Add a new marker at the searched location
            searchMarker = L.marker([lat, lon]).addTo(map);
            
            // Restore input with searched query
            searchInput.value = searchedQuery;
            searchInput.placeholder = originalPlaceholder;
        } else {
            // Handle not found
            searchInput.value = "";
            searchInput.placeholder = "Location not found...";
            setTimeout(() => {
                searchInput.placeholder = originalPlaceholder;
            }, 2000);
        }
    } catch (error) {
        console.error('Search error:', error);
        searchInput.value = "";
        searchInput.placeholder = "Error connecting...";
        setTimeout(() => {
            const originalPlaceholder = "Search location (e.g., Lugbe)...";
            searchInput.placeholder = originalPlaceholder;
        }, 2000);
    }
}

// Trigger search on button click
searchBtn.addEventListener('click', performSearch);

// Trigger search on Enter key press
searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        performSearch();
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
    const originalPlaceholder = searchInput.placeholder;
    searchInput.value = "";
    searchInput.placeholder = "Location access denied/failed...";
    setTimeout(() => {
        searchInput.placeholder = originalPlaceholder;
    }, 3000);
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
            map.removeLayer(layer_OSM_0);
            map.addLayer(layer_GoogleHybrid_0);
        } else if (layer === 'osm') {
            map.removeLayer(layer_GoogleHybrid_0);
            map.addLayer(layer_OSM_0);
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

sidebarToggle.setAttribute('aria-expanded', String(!sidebar.classList.contains('collapsed')));