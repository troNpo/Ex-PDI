// ==========================================
// CONFIGURACIÓN Y MAPAS BASE
// ==========================================

const baseMaps = {
  'osm': {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  'topo': {
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    maxzoom: 17,
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
  },
  'esri': {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 18,
    attribution: '&copy; Esri World Imagery'
  }
};

let searchRadiusKm = 5.0;
let poiMarkers = [];


// ==========================================
// INICIALIZACIÓN DE MAPLIBRE Y CONTROLES
// ==========================================

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'base-tiles': {
        type: 'raster',
        tiles: baseMaps['osm'].tiles,
        tileSize: 256,
        attribution: baseMaps['osm'].attribution
      },
      'terrarium-dem': {
        tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        type: 'raster-dem',
        tileSize: 512,
        encoding: 'terrarium'
      },
      'waymarked-hiking': {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      },
      'waymarked-cycling': {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      },
      'waymarked-mtb': {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      }
    },
    layers: [
      {
        id: 'base-layer',
        type: 'raster',
        source: 'base-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ],
    terrain: {
      source: 'terrarium-dem',
      exaggeration: 1.2
    }
  },
  center: [-3.70379, 40.41678],
  zoom: 12,
  pitch: 65,      
  maxPitch: 85    
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true
  }),
  'top-right'
);

const scale = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });
map.addControl(scale, 'top-left');


// ==========================================
// GESTIÓN DEL ÁREA DE BÚSQUEDA VISUAL Y CARTEL
// ==========================================

const sheetContent = document.getElementById('sheet-content');

// Crear cartel informativo flotante (Escala + Radio + Modo)
const feedbackBanner = document.createElement('div');
feedbackBanner.className = 'map-feedback-banner';
feedbackBanner.innerHTML = `
  <div style="font-size: 11px; color: #ffcccc; margin-bottom: 2px;">
    <strong>Radio:</strong> <span id="banner-radius">${searchRadiusKm} km</span> &nbsp;|&nbsp; 
    <strong>Escala:</strong> <span id="banner-scale">-</span>
  </div>
  <div style="font-size: 11px; color: #ffffff;">
    <strong>Modo:</strong> <span id="banner-mode">1 checkbox (40 máx.)</span>
  </div>
`;
document.body.appendChild(feedbackBanner);

function updateFeedbackBanner() {
  const scaleEl = document.getElementById('banner-scale');
  const radiusEl = document.getElementById('banner-radius');
  
  if (radiusEl) radiusEl.textContent = `${searchRadiusKm} km`;
  
  if (scaleEl) {
    const scaleElem = document.querySelector('.maplibregl-ctrl-scale');
    if (scaleElem) {
      scaleEl.textContent = scaleElem.textContent;
    }
  }
}

map.on('load', () => {
  map.addSource('search-area-source', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[]] }
    }
  });

  map.addLayer({
    id: 'search-area-fill',
    type: 'fill',
    source: 'search-area-source',
    paint: { 'fill-color': '#b7092b', 'fill-opacity': 0.1 }
  });

  map.addLayer({
    id: 'search-area-border',
    type: 'line',
    source: 'search-area-source',
    paint: { 'line-color': '#b7092b', 'line-width': 2, 'line-dasharray': [3, 3] }
  });

  updateSearchAreaPolygon();
  setInterval(updateFeedbackBanner, 1000);
});

function updateSearchAreaPolygon() {
  const source = map.getSource('search-area-source');
  if (!source) return;

  const padding = map.getPadding();
  const container = map.getContainer();
  
  const visualPoint = [
    (container.clientWidth + padding.left - padding.right) / 2,
    (container.clientHeight + padding.top - padding.bottom) / 2
  ];

  const center = map.unproject(visualPoint);
  const latDelta = searchRadiusKm / 111.0;
  const lngDelta = searchRadiusKm / (111.0 * Math.cos(center.lat * (Math.PI / 180)));

  const west = center.lng - lngDelta;
  const east = center.lng + lngDelta;
  const north = center.lat + latDelta;
  const south = center.lat - latDelta;

  const polygonGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [west, north], [east, north], [east, south], [west, south], [west, north]
      ]]
    }
  };

  source.setData(polygonGeoJSON);
  updateFeedbackBanner();
}

map.on('move', () => {
  updateSearchAreaPolygon();
});

const headerMain = document.getElementById('header-main-actions');
const headerTabs = document.getElementById('header-tabs-actions');
const btnClearMarkersHeader = document.getElementById('btn-clear-markers-header');

function updateClearMarkersButtonVisibility() {
  if (!btnClearMarkersHeader) return;
  if (poiMarkers.length > 0) {
    btnClearMarkersHeader.classList.remove('hidden');
  } else {
    btnClearMarkersHeader.classList.add('hidden');
  }
}

function updateMapPadding() {
  const isSheetOpen = headerMain && !headerMain.classList.contains('hidden');
  
  if (isSheetOpen) {
    const topOffset = window.innerHeight * 0.25;
    map.easeTo({ padding: { top: topOffset, bottom: 0, left: 0, right: 0 }, duration: 300, essential: true });
  } else {
    map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 300, essential: true });
  }

  setTimeout(updateSearchAreaPolygon, 50);
  setTimeout(updateSearchAreaPolygon, 320);
}


// ==========================================
// UTILIDADES VISUALES Y BUSCADOR DE LUGARES
// ==========================================

function showToast(message, duration = 3000) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.85); color: #fff; padding: 10px 18px;
      border-radius: 8px; font-size: 13px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      text-align: center; transition: opacity 0.3s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  
  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

const searchToggle = document.getElementById('search-toggle');
const searchBox = document.getElementById('search-box');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchMarker = null;

if (searchToggle) {
  searchToggle.addEventListener('click', () => {
    searchBox.classList.toggle('hidden');
    if (!searchBox.classList.contains('hidden')) {
      searchInput.focus();
    } else {
      searchResults.innerHTML = '';
    }
  });
}

let timeout = null;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    const query = searchInput.value.trim();

    if (query.length < 3) {
      searchResults.innerHTML = '';
      return;
    }

    timeout = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
        .then((res) => res.json())
        .then((data) => {
          searchResults.innerHTML = '';
          data.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item.display_name;
            li.addEventListener('click', () => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);

              map.flyTo({ center: [lon, lat], zoom: 15 });

              if (searchMarker) searchMarker.remove();
              searchMarker = new maplibregl.Marker({ color: '#e74c3c' })
                .setLngLat([lon, lat])
                .setPopup(new maplibregl.Popup().setText(item.display_name))
                .addTo(map);

              searchResults.innerHTML = '';
              searchBox.classList.add('hidden');
            });
            searchResults.appendChild(li);
          });
        });
    }, 400);
  });
}


// ==========================================
// GESTIÓN DEL PANEL INFERIOR (BOTTOM SHEET)
// ==========================================

const sheet = document.getElementById('bottom-sheet');
const sheetHeader = document.getElementById('sheet-header');

let startY = 0;
let currentY = 0;
let isDragging = false;
let startTransform = 0;

function getSnapPoints() {
  const vh = window.innerHeight;
  return { SNAP_FULL: vh * 0.5, SNAP_CLOSED: vh - 58 };
}

function getTranslateY() {
  const style = window.getComputedStyle(sheet);
  const matrix = new WebKitCSSMatrix(style.transform);
  return matrix.m41 || matrix.f;
}

function initSheetPosition() {
  const { SNAP_CLOSED } = getSnapPoints();
  sheet.style.transform = `translateY(${SNAP_CLOSED}px)`;
}

initSheetPosition();

if (sheetHeader) {
  sheetHeader.addEventListener('touchstart', (e) => {
    isDragging = true;
    startY = e.touches[0].clientY;
    startTransform = getTranslateY();
    sheet.style.transition = 'none';
  });
}

window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  currentY = e.touches[0].clientY;
  const delta = currentY - startY;
  let newY = startTransform + delta;

  const { SNAP_FULL, SNAP_CLOSED } = getSnapPoints();
  if (newY < SNAP_FULL) newY = SNAP_FULL;
  if (newY > SNAP_CLOSED) newY = SNAP_CLOSED;

  sheet.style.transform = `translateY(${newY}px)`;
});

window.addEventListener('touchend', () => {
  if (!isDragging) return;
  isDragging = false;
  sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';

  const finalY = getTranslateY();
  const { SNAP_FULL, SNAP_CLOSED } = getSnapPoints();
  const threshold = (SNAP_FULL + SNAP_CLOSED) / 2;

  if (finalY < threshold) {
    sheet.style.transform = `translateY(${SNAP_FULL}px)`;
  } else {
    sheet.style.transform = `translateY(${SNAP_CLOSED}px)`;
  }

  setTimeout(updateMapPadding, 300);
});

window.addEventListener('resize', initSheetPosition);

// Evento para el botón de limpiar marcadores en la cabecera roja
if (btnClearMarkersHeader) {
  btnClearMarkersHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPoiMarkers();
    showToast('Marcadores eliminados del mapa');
  });
}


// ==========================================
// CARGA Y GESTIÓN DE CATEGORÍAS (UI)
// ==========================================

let categoriesHTML = '';

async function loadCategories() {
  try {
    const response = await fetch('categories.json');
    const categories = await response.json();
    const container = document.querySelector('.poi-categories');
    
    if (!container) return;
    container.innerHTML = '';

    categories.forEach((cat, catIndex) => {
      const li = document.createElement('li');
      li.className = 'category-item';

      let nodesHTML = '';
      cat.nodes.forEach((node, nodeIndex) => {
        nodesHTML += `
          <li>
            <label class="checkbox-container">
              <input type="checkbox" data-val="${node.v}" data-node-id="${node.id}" data-cat="${catIndex}" data-node="${nodeIndex}">
              <span>${node.name}</span>
            </label>
          </li>
        `;
      });

      li.innerHTML = `
        <div class="category-row">
          <label class="checkbox-container">
            <input type="checkbox" data-cat-id="${cat.id}">
            <span class="cat-name">${cat.name}</span>
          </label>
          <button class="arrow-icon-btn" aria-label="Expandir">
            <img src="icons/chevron.svg" alt="Expandir" width="22" height="22">
          </button>
        </div>
        <ul class="subcategory-list">
          ${nodesHTML}
        </ul>
      `;

      container.appendChild(li);
    });

    initCategoryEvents();
    if (sheetContent) categoriesHTML = sheetContent.innerHTML;

  } catch (error) {
    console.error('Error al cargar las categorías:', error);
    showToast('Error al cargar categories.json');
  }
}

function initCategoryEvents() {
  const expandToggle = document.getElementById('expand-nodes-toggle');
  if (expandToggle) {
    expandToggle.addEventListener('change', () => {
      const isChecked = expandToggle.checked;
      document.querySelectorAll('.category-item').forEach(item => {
        if (isChecked) item.classList.add('active');
        else item.classList.remove('active');
      });
    });
  }

  document.querySelectorAll('.category-item').forEach(item => {
    const parentCheckbox = item.querySelector('.category-row input[type="checkbox"]');
    const childCheckboxes = item.querySelectorAll('.subcategory-list input[type="checkbox"]');
    const row = item.querySelector('.category-row');

    if (parentCheckbox) {
      parentCheckbox.addEventListener('change', () => {
        const isChecked = parentCheckbox.checked;
        parentCheckbox.indeterminate = false;
        childCheckboxes.forEach(child => child.checked = isChecked);
      });
    }

    childCheckboxes.forEach(child => {
      child.addEventListener('change', () => {
        const total = childCheckboxes.length;
        const checkedCount = item.querySelectorAll('.subcategory-list input[type="checkbox"]:checked').length;

        if (checkedCount === 0) {
          parentCheckbox.checked = false;
          parentCheckbox.indeterminate = false;
        } else if (checkedCount === total) {
          parentCheckbox.checked = true;
          parentCheckbox.indeterminate = false;
        } else {
          parentCheckbox.checked = false;
          parentCheckbox.indeterminate = true;
        }
      });
    });

    if (row) {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        item.classList.toggle('active');
      });
    }
  });
}


// ==========================================
// CONFIGURACIÓN DE PESTAÑAS Y AJUSTES
// ==========================================

const settingsConfig = [
  {
    "tab": "maps-layers",
    "sections": [
      {
        "title": "Mapa Base",
        "type": "radio",
        "name": "base-map",
        "options": [
          { "label": "OpenStreetMap", "value": "osm", "checked": true },
          { "label": "OpenTopoMap", "value": "topo", "checked": false },
          { "label": "Satélite (Esri)", "value": "esri", "checked": false }
        ]
      },
      {
        "title": "Capas Superpuestas (Waymarked Trails)",
        "type": "checkbox",
        "options": [
          { "label": "Senderismo (Hiking)", "id": "layer-hiking" },
          { "label": "Ciclismo (Bicycle)", "id": "layer-bicycle" },
          { "label": "MTB", "id": "layer-mtb" },
          { "label": "Subir archivo GPX / KML", "id": "layer-upload" }
        ]
      }
    ]
  },
  {
    "tab": "tools",
    "title": "Utilidades y Datos",
    "items": [
      { "label": "Descargar POIs visibles (GPX/JSON)", "action": "download-pois" }
    ]
  }
];

const btnMore = document.getElementById('btn-more');

if (btnMore) {
  btnMore.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMain.classList.add('hidden');
    headerTabs.classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const defaultTabBtn = document.querySelector('.tab-btn[data-tab="maps-layers"]');
    if (defaultTabBtn) defaultTabBtn.classList.add('active');
    
    renderTabContent('maps-layers');

    const { SNAP_FULL } = getSnapPoints();
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    sheet.style.transform = `translateY(${SNAP_FULL}px)`;

    updateMapPadding();
  });
}

document.querySelectorAll('.sheet-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => { e.stopPropagation(); });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');

    if (tabName === 'main') {
      headerTabs.classList.add('hidden');
      headerMain.classList.remove('hidden');
      sheetContent.innerHTML = categoriesHTML;
      initCategoryEvents();
      updateMapPadding();
      return;
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTabContent(tabName);
  });
});

/**
 * Renderiza dinámicamente el contenido de las pestañas de configuración del panel.
 */
function renderTabContent(tabName) {
  const tabData = settingsConfig.find(t => t.tab === tabName);
  
  if (!tabData) {
    if (tabName === 'download' || tabName === 'downloads') {
      sheetContent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #888; font-size: 13px;">
          Sección vacía
        </div>
      `;
    } else {
      sheetContent.innerHTML = '';
    }
    return;
  }

  if (tabName === 'maps-layers') {
    let html = '';
    tabData.sections.forEach(sec => {
      html += `<div class="settings-group"><div class="settings-section-title">${sec.title}</div><div class="poi-categories">`;
      sec.options.forEach(opt => {
        if (sec.type === 'radio') {
          html += `
            <label class="checkbox-container" style="padding: 8px 0;">
              <input type="radio" name="${sec.name}" value="${opt.value}" ${opt.checked ? 'checked' : ''}>
              <span>${opt.label}</span>
            </label>
          `;
        } else {
          html += `
            <li class="category-row">
              <label class="checkbox-container">
                <input type="checkbox" id="${opt.id}">
                <span>${opt.label}</span>
              </label>
            </li>
          `;
        }
      });
      html += `</div></div>`;
    });
    sheetContent.innerHTML = html;

    const currentBaseSource = map.getSource('base-tiles');
    if (currentBaseSource) {
      const activeTileUrl = currentBaseSource.tiles[0];
      for (const [key, val] of Object.entries(baseMaps)) {
        if (val.tiles[0] === activeTileUrl) {
          const radioToCheck = sheetContent.querySelector(`input[name="base-map"][value="${key}"]`);
          if (radioToCheck) radioToCheck.checked = true;
          break;
        }
      }
    }

    document.querySelectorAll('input[name="base-map"]').forEach(radio => {
      radio.addEventListener('change', (ev) => {
        const selectedKey = ev.target.value;
        const newSource = baseMaps[selectedKey];
        if (!newSource) return;

        if (map.getLayer('base-layer')) map.removeLayer('base-layer');
        if (map.getSource('base-tiles')) map.removeSource('base-tiles');

        map.addSource('base-tiles', {
          type: 'raster',
          tiles: newSource.tiles,
          tileSize: 256,
          attribution: newSource.attribution
        });

        const firstOverlay = ['layer-hiking', 'layer-bicycle', 'layer-mtb'].find(id => map.getLayer(id));

        map.addLayer({
          id: 'base-layer',
          type: 'raster',
          source: 'base-tiles',
          minzoom: 0,
          maxzoom: newSource.maxzoom
        }, firstOverlay);

        if (map.getLayer('search-area-fill')) map.removeLayer('search-area-fill');
        if (map.getLayer('search-area-border')) map.removeLayer('search-area-border');

        map.addLayer({
          id: 'search-area-fill',
          type: 'fill',
          source: 'search-area-source',
          paint: { 'fill-color': '#b7092b', 'fill-opacity': 0.1 }
        });

        map.addLayer({
          id: 'search-area-border',
          type: 'line',
          source: 'search-area-source',
          paint: { 'line-color': '#b7092b', 'line-width': 2, 'line-dasharray': [3, 3] }
        });

        updateSearchAreaPolygon();
      });
    });

    const toggleLayerBinding = (id, sourceName) => {
      const chk = document.getElementById(id);
      if (chk) {
        chk.checked = map.getLayer(id) !== undefined;
        chk.addEventListener('change', (ev) => {
          if (ev.target.checked) {
            if (!map.getLayer(id)) {
              map.addLayer({ id: id, type: 'raster', source: sourceName, minzoom: 0, maxzoom: 18 });
            }
          } else {
            if (map.getLayer(id)) map.removeLayer(id);
          }
        });
      }
    };

    toggleLayerBinding('layer-hiking', 'waymarked-hiking');
    toggleLayerBinding('layer-bicycle', 'waymarked-cycling');
    toggleLayerBinding('layer-mtb', 'waymarked-mtb');

  } else if (tabName === 'tools') {
    let html = `<div class="settings-group"><div class="settings-section-title">${tabData.title}</div>`;
    tabData.items.forEach(item => {
      html += `
        <div class="category-row" style="cursor: pointer; padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
          <span>${item.label}</span>
        </div>`;
    });
    html += `</div>`;
    sheetContent.innerHTML = html;
  }
}


// ==========================================
// GESTIÓN DE BÚSQUEDA OPTIMIZADA DE PDI
// ==========================================

const btnCheck = document.getElementById('btn-check'); 
const btnCancel = document.getElementById('btn-cancel'); 

const categoryPalettes = [
  { base: '#27ae60', shades: ['#27ae60', '#2ecc71', '#1abc9c', '#16a085'] },
  { base: '#2980b9', shades: ['#2980b9', '#3498db', '#00cec9', '#0984e3'] },
  { base: '#d35400', shades: ['#d35400', '#e67e22', '#f39c12', '#e58e26'] },
  { base: '#8e44ad', shades: ['#8e44ad', '#9b59b6', '#6c5ce7', '#a29bfe'] },
  { base: '#c0392b', shades: ['#c0392b', '#e74c3c', '#ff7675', '#d63031'] }
];

function getNodeColor(categoryIndex, nodeIndex) {
  const palette = categoryPalettes[categoryIndex % categoryPalettes.length];
  return palette.shades[nodeIndex % palette.shades.length];
}

if (btnCheck) {
  btnCheck.addEventListener('click', () => {
    const categoryItems = document.querySelectorAll('.category-item');
    const searchTerms = [];

    categoryItems.forEach((catItem) => {
      const childCheckboxes = catItem.querySelectorAll('.subcategory-list input[type="checkbox"]:checked');
      
      childCheckboxes.forEach((chk) => {
        const val = chk.getAttribute('data-val');
        const catIndex = parseInt(chk.getAttribute('data-cat'));
        const nodeIndex = parseInt(chk.getAttribute('data-node'));
        
        if (val) {
          const terms = val.split('|');
          terms.forEach(term => {
            searchTerms.push({ term: term.trim(), catIndex, nodeIndex });
          });
        }
      });
    });

    if (searchTerms.length === 0) {
      showToast('Selecciona al menos una subcategoría');
      return;
    }

    showToast(`Buscando en radio de ${searchRadiusKm} km...`);
    updateSearchAreaPolygon();

    const padding = map.getPadding();
    const container = map.getContainer();
    const visualPoint = [
      (container.clientWidth + padding.left - padding.right) / 2,
      (container.clientHeight + padding.top - padding.bottom) / 2
    ];
    const center = map.unproject(visualPoint);

    const latDelta = searchRadiusKm / 111.0;
    const lngDelta = searchRadiusKm / (111.0 * Math.cos(center.lat * (Math.PI / 180)));

    const viewbox = `${center.lng - lngDelta},${center.lat + latDelta},${center.lng + lngDelta},${center.lat - latDelta}`;

    fetchPOIsOptimized(searchTerms, viewbox);
  });
}

if (btnCancel) {
  btnCancel.addEventListener('click', () => {
    document.querySelectorAll('.poi-categories input[type="checkbox"]').forEach(chk => {
      chk.checked = false;
      chk.indeterminate = false;
    });
    showToast('Filtros reiniciados');
  });
}

function fetchPOIsOptimized(searchTerms, viewbox) {
  clearPoiMarkers();

  const maxConcurrent = 6;
  const uniqueTerms = Array.from(new Set(searchTerms.map(s => s.term))).slice(0, maxConcurrent);

  const promises = uniqueTerms.map((term) => {
    const originalItem = searchTerms.find(s => s.term === term);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}&viewbox=${viewbox}&bounded=1&limit=15`;
    
    return fetch(url, {
      headers: { 'User-Agent': 'EX-PDI-App/1.0' }
    })
    .then(res => res.json())
    .then(data => data.map(place => ({ 
      ...place, 
      color: getNodeColor(originalItem.catIndex, originalItem.nodeIndex) 
    })))
    .catch(err => {
      console.error("Error en fetch de Nominatim:", err);
      return [];
    });
  });

  Promise.all(promises)
    .then(results => {
      const flatResults = results.flat();
      const uniquePlaces = Array.from(new Map(flatResults.map(p => [p.place_id, p])).values());
      
      showToast(`Encontrados: ${uniquePlaces.length} PDI`);
      renderPoiMarkers(uniquePlaces);
    })
    .catch(err => {
      console.error('Error general procesando peticiones:', err);
      showToast('Error al consultar la red');
    });
}


// ==========================================
// RENDERIZADO DE MARCADORES Y EVENTOS GLOBALES
// ==========================================

function renderPoiMarkers(places) {
  if (places.length === 0) {
    showToast('No hay resultados en esta vista');
    updateClearMarkersButtonVisibility();
    return;
  }

  places.forEach(place => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    const markerColor = place.color || '#e74c3c';

    const marker = new maplibregl.Marker({ color: markerColor })
      .setLngLat([lon, lat])
      .setPopup(new maplibregl.Popup().setText(place.display_name))
      .addTo(map);

    poiMarkers.push(marker);
  });

  updateClearMarkersButtonVisibility();
}

function clearPoiMarkers() {
  poiMarkers.forEach(marker => marker.remove());
  poiMarkers = [];
  updateClearMarkersButtonVisibility();
}

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
      .catch((err) => console.log('Error al registrar el Service Worker:', err));
  });
}
