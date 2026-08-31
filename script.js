// Fuentes de mapas base disponibles
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

// Inicialización del mapa
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
    ]
  },
  center: [-3.70379, 40.41678],
  zoom: 12
});

// Controles nativos
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true
  }),
  'top-right'
);

// Escala gráfica del mapa
const scale = new maplibregl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
});
map.addControl(scale, 'top-left');

// Evento cambio de mapa base
document.getElementById('map-select').addEventListener('change', (e) => {
  const selectedKey = e.target.value;
  const newSource = baseMaps[selectedKey];

  if (map.getLayer('base-layer')) map.removeLayer('base-layer');
  if (map.getSource('base-tiles')) map.removeSource('base-tiles');

  map.addSource('base-tiles', {
    type: 'raster',
    tiles: newSource.tiles,
    tileSize: 256,
    attribution: newSource.attribution
  });

  map.addLayer({
    id: 'base-layer',
    type: 'raster',
    source: 'base-tiles',
    minzoom: 0,
    maxzoom: newSource.maxzoom
  });
});

// Lógica del buscador de lugares
const searchToggle = document.getElementById('search-toggle');
const searchBox = document.getElementById('search-box');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchMarker = null;

searchToggle.addEventListener('click', () => {
  searchBox.classList.toggle('hidden');
  if (!searchBox.classList.contains('hidden')) {
    searchInput.focus();
  } else {
    searchResults.innerHTML = '';
  }
});

let timeout = null;
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

// Arrastre e inercia del Bottom Sheet
const sheet = document.getElementById('bottom-sheet');
const sheetHeader = document.getElementById('sheet-header');

let startY = 0;
let currentY = 0;
let isDragging = false;
let startTransform = 0;

function getSnapPoints() {
  const vh = window.innerHeight;
  return {
    SNAP_FULL: 0,
    SNAP_HALF: vh * 0.5,
    SNAP_CLOSED: vh - 50
  };
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

sheetHeader.addEventListener('touchstart', (e) => {
  isDragging = true;
  startY = e.touches[0].clientY;
  startTransform = getTranslateY();
  sheet.style.transition = 'none';
});

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
  const { SNAP_FULL, SNAP_HALF, SNAP_CLOSED } = getSnapPoints();

  if (finalY < (SNAP_FULL + SNAP_HALF) / 2) {
    sheet.style.transform = `translateY(${SNAP_FULL}px)`;
  } else if (finalY > (SNAP_HALF + SNAP_CLOSED) / 2) {
    sheet.style.transform = `translateY(${SNAP_CLOSED}px)`;
  } else {
    sheet.style.transform = `translateY(${SNAP_HALF}px)`;
  }
});

window.addEventListener('resize', initSheetPosition);

// Carga dinámica de categorías desde categories.json
async function loadCategories() {
  try {
    const response = await fetch('categories.json');
    const categories = await response.json();
    const container = document.querySelector('.poi-categories');
    
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
      const li = document.createElement('li');
      li.className = 'category-item';

      let nodesHTML = '';
      cat.nodes.forEach(node => {
        nodesHTML += `
          <li>
            <label class="checkbox-container">
              <input type="checkbox" data-key="${node.k}" data-val="${node.v}" data-node-id="${node.id}">
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

  } catch (error) {
    console.error('Error al cargar las categorías:', error);
  }
}

// Inicialización de eventos para checkboxes y switch
function initCategoryEvents() {
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

  // Switch "Expandir nodos"
  const expandToggle = document.getElementById('expand-nodes-toggle');
  if (expandToggle) {
    expandToggle.addEventListener('change', (e) => {
      const isExpanded = e.target.checked;
      document.querySelectorAll('.category-item').forEach(item => {
        if (isExpanded) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    });
  }
}

// Cargar categorías al iniciar
document.addEventListener('DOMContentLoaded', loadCategories);
