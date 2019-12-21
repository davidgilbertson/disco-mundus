/**
 * This file looks after loading the map and any map data, including suburbs.
 * Any logic ...
 */
import {MAP_LAYERS, FEATURE_STATUS} from './constants.mjs';
import * as dom from "./dom.mjs";

mapboxgl.accessToken = 'pk.eyJ1IjoiZGF2aWRnNzA3IiwiYSI6ImNqZWVxaGtnazF2czAyeXFlcDlvY2kwZDQifQ.WSmiQO0ccl85_FvEDTsBmw';

let map;
let lastHoveredFeatureId = null;
const featuresWithStatus = new Map();
const popups = [];

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
  console.log('>  mapbox.mjs:64 > markWrong > featureId', featureId);
  setStatus({featureId, status: FEATURE_STATUS.WRONG});
  console.log('>  mapbox.mjs:66 > markWrong > featuresWithStatus', featuresWithStatus);
};

export const clearSelected = () => {
  clearStatuses(FEATURE_STATUS.SELECTED);
};

const hover = featureId => {
  setStatus({featureId, status: FEATURE_STATUS.HOVERED});
};

export const init = ({onLoad, onFeatureClick}) => {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: {
      lng: 151.09599472830712,
      lat: -33.856237652995084,
    },
    zoom: 11,
  });

  map.on('load', async () => {
    const data = await fetch('suburbBoundaries.json').then(response => response.json());

    map.addLayer({
      id: MAP_LAYERS.SUBURBS,
      type: 'fill',
      source: {
        type: 'geojson',
        data,
      },
      paint: {
        'fill-color': [
          'match',
          ['feature-state', 'status'],
          FEATURE_STATUS.WRONG, 'rgba(240, 0, 0, 0.3)',
          FEATURE_STATUS.SELECTED, 'rgba(0, 0, 200, 0.3)',
          FEATURE_STATUS.HOVERED, 'rgba(0, 0, 200, 0.1)',
          'rgba(0, 0, 0, 0)'
        ],
        'fill-outline-color': 'rgba(0, 0, 0, 0.4)',
      },
    });

    onLoad(data);
  });

  map.on('mousemove', MAP_LAYERS.SUBURBS, e => {
    if (e.features.length > 0) {
      const thisFeatureId = e.features[0].id;
      // If the mouse is still on the same hovered feature, bail
      if (lastHoveredFeatureId && thisFeatureId === lastHoveredFeatureId) return;

      lastHoveredFeatureId = thisFeatureId;

      clearStatuses(FEATURE_STATUS.HOVERED);

      dom.setHintText(e.features[0].properties.name);

      if (
        featuresWithStatus.get(thisFeatureId) !== FEATURE_STATUS.SELECTED &&
        featuresWithStatus.get(thisFeatureId) !== FEATURE_STATUS.WRONG
      ) {
        hover(thisFeatureId);
      }
    }
  });

  // When the mouse leaves the layer, e.g. goes outside Sydney (NOT leaves a feature)
  map.on('mouseleave', MAP_LAYERS.SUBURBS, () => {
    lastHoveredFeatureId = null;
    clearStatuses(FEATURE_STATUS.HOVERED);

    dom.setHintText('');
  });

  map.on('click', MAP_LAYERS.SUBURBS, e => {
    if (e.features.length > 0) {
      const clickedFeature = e.features[0];
      const featureIsAlreadySelected = featuresWithStatus.get(clickedFeature.id) === FEATURE_STATUS.SELECTED;

      clearStatuses();
      // clearStatuses(FEATURE_STATUS.SELECTED);
      clearPopups();

      if (featureIsAlreadySelected) {
        hover(clickedFeature.id);
      } else {
        select(clickedFeature.id);

        addPopup({
          lngLat: JSON.parse(clickedFeature.properties.center),
          text: clickedFeature.properties.name,
        });
      }

      onFeatureClick({lngLat: e.lngLat, feature: clickedFeature});
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Escape') {
      clearStatuses(FEATURE_STATUS.SELECTED);
      clearPopups();
    }
  });

  return map;
};
