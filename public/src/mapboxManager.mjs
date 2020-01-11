/**
 * This file looks after loading the map and any map data, including suburbs.
 * Any logic that interacts with the map goes in here
 */
import { MAP_LAYERS, FEATURE_STATUS, MAP_SOURCES } from './constants.mjs';
import * as geoUtils from './utils/geoUtils.mjs';

mapboxgl.accessToken =
  'pk.eyJ1IjoiZGF2aWRnNzA3IiwiYSI6ImNqZWVxaGtnazF2czAyeXFlcDlvY2kwZDQifQ.WSmiQO0ccl85_FvEDTsBmw';

let map;
let lastHoveredFeatureId = null;
const featuresWithStatus = new Map();
const popups = [];

export const panTo = feature => {
  map.panTo(feature.properties.center);
};

export const addPopup = ({ lngLat, text }) => {
  popups.push(
    new mapboxgl.Popup()
      .setLngLat(lngLat)
      .setHTML(text)
      .addTo(map)
  );
};

export const clearPopups = () => {
  popups.forEach(popup => popup.remove());
};

export const clearStatus = featureId => {
  if (!featureId) return;

  featuresWithStatus.delete(featureId);

  map.removeFeatureState({ source: MAP_LAYERS.SUBURBS, id: featureId });
};

/**
 * @param {string} [statusToClear] - only clear features with this particular status
 */
export const clearStatuses = statusToClear => {
  featuresWithStatus.forEach((status, featureId) => {
    if (statusToClear && statusToClear !== status) return;

    clearStatus(featureId);
  });
};

export const setStatus = ({ featureId, status }) => {
  if (!featureId) return;

  featuresWithStatus.set(featureId, status);

  map.setFeatureState(
    { source: MAP_LAYERS.SUBURBS, id: featureId },
    { status }
  );
};

export const select = featureId => {
  setStatus({ featureId, status: FEATURE_STATUS.SELECTED });
};

export const markWrong = featureId => {
  setStatus({ featureId, status: FEATURE_STATUS.WRONG });
};

export const markRight = featureId => {
  setStatus({ featureId, status: FEATURE_STATUS.RIGHT });
};

const hover = featureId => {
  setStatus({ featureId, status: FEATURE_STATUS.HOVERED });
};

export const addSuburbsLayer = suburbsFeatureCollection => {
  map.addSource(MAP_SOURCES.SUBURBS, {
    type: 'geojson',
    data: suburbsFeatureCollection,
  });

  map.addLayer({
    id: MAP_LAYERS.SUBURBS,
    source: MAP_SOURCES.SUBURBS,
    type: 'fill',
    paint: {
      // prettier-ignore
      'fill-color': [
        'match',
        ['feature-state', 'status'],
        FEATURE_STATUS.WRONG, 'rgba(240, 0, 0, 0.2)',
        FEATURE_STATUS.RIGHT, 'rgba(0, 200, 0, 0.2)',
        FEATURE_STATUS.SELECTED, 'rgba(0, 97, 200, 0.1)',
        'rgba(0, 0, 0, 0)' // not visible
      ]
    },
  });

  map.addLayer({
    id: MAP_LAYERS.SUBURBS_LINE,
    source: MAP_SOURCES.SUBURBS,
    type: 'line',
    // prettier-ignore
    paint: {
      'line-color': [
        'match',
        ['feature-state', 'status'],
        FEATURE_STATUS.WRONG, 'rgba(240, 0, 0, 1)',
        FEATURE_STATUS.RIGHT, 'rgba(0, 200, 0, 1)',
        FEATURE_STATUS.SELECTED, 'rgba(0, 97, 200, 1)',
        FEATURE_STATUS.HOVERED, 'rgba(255, 255, 255, 1)',
        'rgba(255, 255, 255, 0.3)'
      ],
      'line-width': [
        'match',
        ['feature-state', 'status'],
        FEATURE_STATUS.WRONG, 3,
        FEATURE_STATUS.RIGHT, 3,
        FEATURE_STATUS.SELECTED, 3,
        FEATURE_STATUS.HOVERED, 1,
        0.5
      ],
    }
  });
};

export const onClick = cb => {
  map.on('click', cb);
};

export const init = ({ onFeatureClick }) =>
  new Promise(resolve => {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v9',
      center: {
        lng: 151.09599472830712,
        lat: -33.856237652995084,
      },
      zoom: 11,
    });

    map.on('mouseenter', MAP_LAYERS.SUBURBS, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mousemove', MAP_LAYERS.SUBURBS, e => {
      if (e.features.length > 0) {
        const thisFeatureId = e.features[e.features.length - 1].id;
        // If the mouse is still on the same hovered feature, bail
        if (lastHoveredFeatureId && thisFeatureId === lastHoveredFeatureId) {
          return;
        }

        lastHoveredFeatureId = thisFeatureId;

        clearStatuses(FEATURE_STATUS.HOVERED);

        // Only if this feature doesn't have some sort of status already, hover it
        if (!featuresWithStatus.get(thisFeatureId)) {
          hover(thisFeatureId);
        }
      }
    });

    // When the mouse leaves the layer
    map.on('mouseleave', MAP_LAYERS.SUBURBS, () => {
      map.getCanvas().style.cursor = '';
      lastHoveredFeatureId = null;
      clearStatuses(FEATURE_STATUS.HOVERED);
    });

    map.on('click', MAP_LAYERS.SUBURBS, e => {
      if (e.features.length > 0) {
        const topFeature = e.features[e.features.length - 1];
        const featureCollection = map.getSource(MAP_LAYERS.SUBURBS).serialize()
          .data;

        /** @type {QuestionFeature} */
        const clickedFeature = featureCollection.features.find(
          feature => feature.id === topFeature.id
        );

        const status = featuresWithStatus.get(clickedFeature.id);
        const featureIsAlreadySelected = status === FEATURE_STATUS.SELECTED;

        clearStatuses();
        clearPopups();

        if (featureIsAlreadySelected) {
          hover(clickedFeature.id);
        } else {
          select(clickedFeature.id);

          addPopup({
            lngLat: geoUtils.getTopPoint(clickedFeature),
            text: clickedFeature.properties.name,
          });
        }

        onFeatureClick({
          clickCoords: [e.lngLat.lng, e.lngLat.lat],
          clickedFeature,
        });
      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'Escape') {
        clearStatuses(FEATURE_STATUS.SELECTED);
        clearPopups();
      }
    });

    map.on('load', () => {
      map
        .getStyle()
        .layers.filter(layer => layer.type === 'symbol')
        .forEach(layer => {
          // Show the place labels only when zoomed in a bit more
          if (layer.id.startsWith('place-')) {
            map.setLayerZoomRange(layer.id, layer.minzoom + 2, layer.maxzoom);
          }

          // Make the road labels visible sooner
          if (layer.id === 'road-label-xlarge') {
            map.setLayerZoomRange(layer.id, layer.minzoom - 2, layer.maxzoom);
          }
        });

      resolve();
    });
  });
