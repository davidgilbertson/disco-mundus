/**
 * This file looks after loading the map and any map data, including suburbs.
 * Any logic ...
 */
import {MAP_LAYERS, FEATURE_STATUS} from './constants.mjs';
import * as dom from "./dom.mjs";
import * as geoUtils from './geoUtils.mjs';

mapboxgl.accessToken = 'pk.eyJ1IjoiZGF2aWRnNzA3IiwiYSI6ImNqZWVxaGtnazF2czAyeXFlcDlvY2kwZDQifQ.WSmiQO0ccl85_FvEDTsBmw';

let map;
let lastHoveredFeatureId = null;
const featuresWithStatus = new Map();
const popups = [];

export const panTo = feature => {
  map.panTo(feature.properties.center);
};

export const addPopup = ({lngLat, text}) => {
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

  map.removeFeatureState({source: MAP_LAYERS.SUBURBS, id: featureId});
};

/**
 *
 * @param {string} [statusToClear] - only clear features with this particular status
 */
export const clearStatuses = statusToClear => {
  featuresWithStatus.forEach((status, featureId) => {
    if (statusToClear && statusToClear !== status) return;

    clearStatus(featureId);
  });
};

export const setStatus = ({featureId, status}) => {
  if (!featureId) return;

  featuresWithStatus.set(featureId, status);

  map.setFeatureState(
    {source: MAP_LAYERS.SUBURBS, id: featureId},
    {status: status}
  );
};

export const select = featureId => {
  setStatus({featureId, status: FEATURE_STATUS.SELECTED});
};

export const markWrong = featureId => {
  setStatus({featureId, status: FEATURE_STATUS.WRONG});
};

export const markRight = featureId => {
  setStatus({featureId, status: FEATURE_STATUS.RIGHT});
};

const hover = featureId => {
  setStatus({featureId, status: FEATURE_STATUS.HOVERED});
};
export const addSuburbsLayer = suburbsFeatureCollection => map.addLayer({
  id: MAP_LAYERS.SUBURBS,
  type: 'fill',
  source: {
    type: 'geojson',
    data: suburbsFeatureCollection,
  },
  paint: {
    'fill-color': [
      'match',
      ['feature-state', 'status'],
      FEATURE_STATUS.WRONG, 'rgba(240, 0, 0, 0.4)',
      FEATURE_STATUS.RIGHT, 'rgba(0, 200, 0, 0.4)',
      FEATURE_STATUS.SELECTED, 'rgba(0,97,200,0.3)',
      FEATURE_STATUS.HOVERED, 'rgba(0, 97, 200, 0.1)',
      'rgba(0, 0, 0, 0)'
    ],
    'fill-outline-color': 'rgba(0, 0, 0, 0.4)',
  },
});

export const init = ({onFeatureClick}) => new Promise(resolve => {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
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
      const thisFeatureId = e.features[0].id;
      // If the mouse is still on the same hovered feature, bail
      if (lastHoveredFeatureId && thisFeatureId === lastHoveredFeatureId) return;

      lastHoveredFeatureId = thisFeatureId;

      clearStatuses(FEATURE_STATUS.HOVERED);

      dom.setHintText(e.features[0].properties.name);

      // Only if this feature doesn't have some sort of status already, hover it
      if (!featuresWithStatus.get(thisFeatureId)) {
        hover(thisFeatureId);
      }
    }
  });

  // When the mouse leaves the layer, e.g. goes outside Sydney (NOT leaves a feature)
  map.on('mouseleave', MAP_LAYERS.SUBURBS, () => {
    map.getCanvas().style.cursor = '';
    lastHoveredFeatureId = null;
    clearStatuses(FEATURE_STATUS.HOVERED);

    dom.setHintText('');
  });

  map.on('click', MAP_LAYERS.SUBURBS, e => {
    if (e.features.length > 0) {
      const featureCollection = map.getSource(MAP_LAYERS.SUBURBS).serialize().data;
      const clickedFeature = featureCollection.features.find(feature => feature.id === e.features[0].id);
      const featureIsAlreadySelected = featuresWithStatus.get(clickedFeature.id) === FEATURE_STATUS.SELECTED;

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
    resolve();
  });
});
