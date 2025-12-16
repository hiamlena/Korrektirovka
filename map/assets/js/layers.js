// assets/js/layers.js
// Модуль слоёв Trans-Time.
// Отвечает за:
//  - загрузку и отображение весовых рамок из GeoJSON;
//  - фильтрацию рамок по bbox маршрута;
//  - безопасный API для router.js / map.js через window.__TT_LAYERS.
//
// ВАЖНО: если что-то пойдёт не так (нет ymaps, нет карты, нет ответа /api/frames),
//        модуль тихо логирует ошибку и НЕ ломает карту.

const HAS_WINDOW = typeof window !== 'undefined';

if (HAS_WINDOW) {
  // Единая точка для всех слоёв карты
  window.__TT_LAYERS = window.__TT_LAYERS || {};
}

let framesManager = null;
let framesVisible = true;
let framesBBox = null;
let framesData = null;
let framesLoadingPromise = null;

/**
 * Безопасно получить карту из глобалов.
 */
function getMap() {
  if (!HAS_WINDOW) return null;
  return (window.__TT_MAP && window.__TT_MAP.map) || window.map || null;
}

/**
 * Проверка готовности ymaps.
 */
function hasYmaps() {
  return typeof ymaps !== 'undefined';
}

/**
 * Проверяем, что точка попадает в bbox.
 * bbox: [[minLon, minLat], [maxLon, maxLat]]
 */
function isPointInBBox(coords, bbox) {
  if (!bbox || !Array.isArray(coords)) return true;
  const [[minLon, minLat], [maxLon, maxLat]] = bbox;
  const lon = coords[0];
  const lat = coords[1];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/**
 * Универсальная загрузка GeoJSON.
 */
async function fetchGeoJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn('[TT][layers] Не удалось загрузить', url + ':', res.status);
      return null;
    }
    const data = await res.json();
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      console.warn('[TT][layers] Некорректный GeoJSON от', url);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[TT][layers] Ошибка сети при загрузке', url + ':', e);
    return null;
  }
}

/**
 * Ленивая загрузка GeoJSON с рамками.
 * Приоритет источников:
 *  1) /api/frames (основной ожидаемый путь)
 *  2) /frames     (если API смонтировано без /api)
 *  3) ./data/frames_ready.geojson (локальный fallback внутри /map)
 */
async function loadFramesGeoJSON() {
  if (framesLoadingPromise) return framesLoadingPromise;

  const candidates = [
    '/api/frames',
    '/frames',
    './data/frames_ready.geojson'
  ];

  framesLoadingPromise = (async () => {
    for (const url of candidates) {
      const data = await fetchGeoJSON(url);
      if (data) {
        framesData = data;
        console.log('[TT][layers] Рамки загружены из', url, '(features:', data.features.length + ')');
        return data;
      }
    }

    console.warn('[TT][layers] Не удалось загрузить рамки ни из одного источника');
    return null;
  })();

  return framesLoadingPromise;
}

/**
 * SVG-иконка "светящаяся точка" (анимация внутри SVG).
 */
function getGlowingDotDataUri() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4da3ff" stop-opacity="1" />
      <stop offset="70%" stop-color="#4da3ff" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#4da3ff" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- пульс -->
  <circle cx="9" cy="9" r="8" fill="url(#g)">
    <animate attributeName="opacity" values="0.35;0.85;0.35" dur="1.8s" repeatCount="indefinite" />
  </circle>

  <!-- ядро -->
  <circle cx="9" cy="9" r="3.3" fill="#4da3ff" stroke="#0b0b0d" stroke-width="1" />
</svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Инициализация ObjectManager для рамок и привязка к карте.
 */
function ensureFramesManager() {
  const map = getMap();
  if (!map || !hasYmaps()) return null;

  if (!framesManager) {
    framesManager = new ymaps.ObjectManager({
      clusterize: true,
      gridSize: 64,
      clusterDisableClickZoom: false
    });

    // Баллоны: оставляем включёнными (иногда полезно для отладки)
    framesManager.options.set('geoObjectOpenBalloonOnClick', true);

    // Светящиеся точки
    framesManager.objects.options.set({
      iconLayout: 'default#image',
      iconImageHref: getGlowingDotDataUri(),
      iconImageSize: [18, 18],
      iconImageOffset: [-9, -9]
    });

    if (framesData && Array.isArray(framesData.features)) {
      framesManager.add(framesData.features);
    }
  }

  if (framesVisible) {
    if (!map.geoObjects.contains(framesManager)) {
      map.geoObjects.add(framesManager);
    }
  } else {
    if (map.geoObjects.contains(framesManager)) {
      map.geoObjects.remove(framesManager);
    }
  }

  return framesManager;
}

/**
 * Внутренняя установка bbox для слоя рамок.
 */
async function internalSetFramesBBox(bbox) {
  framesBBox = bbox || null;

  const map = getMap();
  if (!map || !hasYmaps()) {
    console.warn('[TT][layers] Нет карты или ymaps, пропускаем setFramesBBox');
    return;
  }

  // Ждём загрузку данных
  const data = framesData || (await loadFramesGeoJSON());
  if (!data || !Array.isArray(data.features)) {
    console.warn('[TT][layers] Нет данных рамок, setFramesBBox ничего не делает');
    return;
  }

  const manager = ensureFramesManager();
  if (!manager) return;

  // Если данные пришли после инициализации менеджера — убедимся, что они добавлены
  // (на случай, если ensureFramesManager был вызван раньше загрузки)
  if (manager && manager.objects && data.features && data.features.length) {
    // ObjectManager сам дедуплицирует по id; если id нет — будет добавлено повторно.
    // Поэтому добавляем только один раз: через флаг.
    if (!manager.__tt_frames_added) {
      manager.add(data.features);
      manager.__tt_frames_added = true;
    }
  }

  // Фильтр по bbox и видимости
  manager.setFilter((obj) => {
    if (!framesVisible) return false;
    const g = obj && obj.geometry;
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return false;
    if (!framesBBox) return true;
    return isPointInBBox(g.coordinates, framesBBox);
  });
}

/**
 * Получить список рамок в заданном bbox (для отладочного / аналитического UI).
 */
function getFramesInBBox(bbox) {
  if (!framesData || !Array.isArray(framesData.features)) return [];
  if (!bbox) return framesData.features.slice();

  return framesData.features.filter((f) => {
    const g = f.geometry;
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return false;
    return isPointInBBox(g.coordinates, bbox);
  });
}

/**
 * Публичный API для window.__TT_LAYERS.
 */
if (HAS_WINDOW) {
  const api = (window.__TT_LAYERS = window.__TT_LAYERS || {});

  if (typeof api.setFramesBBox !== 'function') {
    api.setFramesBBox = function setFramesBBox(bbox) {
      internalSetFramesBBox(bbox).catch((e) => {
        console.warn('[TT][layers] Ошибка setFramesBBox:', e);
      });
    };
  }

  if (typeof api.setFramesVisible !== 'function') {
    api.setFramesVisible = function setFramesVisible(visible) {
      framesVisible = !!visible;
      // переустанавливаем текущий bbox, чтобы перерисовать слой
      internalSetFramesBBox(framesBBox).catch((e) => {
        console.warn('[TT][layers] Ошибка setFramesVisible:', e);
      });
    };
  }

  if (typeof api.getFramesInBBox !== 'function') {
    api.getFramesInBBox = function apiGetFramesInBBox(bbox) {
      return getFramesInBBox(bbox);
    };
  }

  console.log('[TT][layers] Модуль слоёв загружен (источник: /api/frames → /frames → ./data/frames_ready.geojson)');
}

// Экспортируем пустой объект, чтобы модуль был валидным ES-модулем.
export {};
