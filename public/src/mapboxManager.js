/**
 * This file looks after loading the map and any map data, including suburbs.
 * Any logic that interacts with the map goes in here
 */
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_LAYERS, FEATURE_STATUS, MAP_SOURCES } from './constants';
import * as geoUtils from './utils/geoUtils';
import { interpolate, match } from './utils/mapboxLayerHelpers';

mapboxgl.accessToken =
  'pk.eyJ1IjoiZGF2aWRnNzA3IiwiYSI6ImNqZWVxaGtnazF2czAyeXFlcDlvY2kwZDQifQ.WSmiQO0ccl85_FvEDTsBmw';

let map;
let lastHoveredFeatureId = null;
const featuresWithStatus = new Map();
const popups = [];

/**
 * @param {QuestionFeature} feature
 */
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

  map.removeFeatureState({
    source: MAP_SOURCES.SUBURBS,
    id: featureId,
  });
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

// TODO (davidg): could all this be some amazing connection with the store
// using afterChange()?
export const setStatus = ({ featureId, status }) => {
  if (!featureId) return;

  featuresWithStatus.set(featureId, status);

  map.setFeatureState(
    { source: MAP_SOURCES.SUBURBS, id: featureId },
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

  map.addLayer(
    {
      id: MAP_LAYERS.LOCATION_BORDERS,
      source: MAP_SOURCES.SUBURBS,
      type: 'line',
      paint: {
        'line-color': interpolate({
          prop: 'zoom',
          type: interpolate.exponential(2),
          stops: [
            { if: 9, then: 'rgba(255, 255, 255, 0.1)' },
            { if: 11, then: 'rgba(255, 255, 255, 0.7)' },
          ],
        }),
        'line-width': interpolate({
          prop: 'zoom',
          type: interpolate.exponential(2),
          stops: [
            { if: 9, then: 0.5 },
            { if: 12, then: 0.9 },
          ],
        }),
      },
    },
    // Show the borders before the first of the line layers
    map.getStyle().layers.find(item => item.type === 'line').id
  );

  // The highlight state layers go on top of everything
  map.addLayer({
    id: MAP_LAYERS.LOCATION_HIGHLIGHT_FILL,
    source: MAP_SOURCES.SUBURBS,
    type: 'fill',
    paint: {
      'fill-color': match({
        state: 'status',
        cases: [
          { if: FEATURE_STATUS.WRONG, then: 'rgba(240, 0, 0, 0.2)' },
          { if: FEATURE_STATUS.RIGHT, then: 'rgba(0, 200, 0, 0.2)' },
          { if: FEATURE_STATUS.SELECTED, then: 'rgba(0, 97, 200, 0.1)' },
          { else: 'rgba(0, 0, 0, 0)' }, // not visible
        ],
      }),
    },
  });

  map.addLayer({
    id: MAP_LAYERS.LOCATION_HIGHLIGHT_LINE,
    source: MAP_SOURCES.SUBURBS,
    type: 'line',
    paint: {
      'line-color': match({
        state: 'status',
        cases: [
          { if: FEATURE_STATUS.WRONG, then: 'rgb(240, 0, 0)' },
          { if: FEATURE_STATUS.RIGHT, then: 'rgb(0, 200, 0)' },
          { if: FEATURE_STATUS.SELECTED, then: 'rgb(0, 97, 200)' },
          { if: FEATURE_STATUS.HOVERED, then: 'rgb(255, 255, 255)' },
          { else: 'rgba(0, 0, 0, 0)' }, // not visible
        ],
      }),
      'line-width': interpolate({
        prop: 'zoom',
        type: interpolate.exponential(2),
        stops: [
          { if: 9, then: 1 },
          { if: 12, then: 2.5 },
        ],
      }),
    },
  });
};

export const onClick = cb => {
  map.on('click', cb);
};

export const init = ({ onFeatureClick }) =>
  new Promise(resolve => {
    const SYDNEY_LNG_LAT = {
      lng: 150.95257825424233,
      lat: -33.856237652995084,
    };
    const SYDNEY_WIDTH_KM = 70;

    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/davidg707/ck53i8fv90e8w1cqqdyi87ka4',
      center: SYDNEY_LNG_LAT,
      zoom: geoUtils.getZoomToFit({
        kms: SYDNEY_WIDTH_KM,
        lat: SYDNEY_LNG_LAT.lat,
      }),
    });

    window.DM_MAP = map;

    map.on('mouseenter', MAP_LAYERS.LOCATION_HIGHLIGHT_FILL, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mousemove', MAP_LAYERS.LOCATION_HIGHLIGHT_FILL, e => {
      if (e.features.length > 0) {
        const thisFeatureId = e.features[0].id;
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
    map.on('mouseleave', MAP_LAYERS.LOCATION_HIGHLIGHT_FILL, () => {
      map.getCanvas().style.cursor = '';
      lastHoveredFeatureId = null;
      clearStatuses(FEATURE_STATUS.HOVERED);
    });

    map.on('click', MAP_LAYERS.LOCATION_HIGHLIGHT_FILL, e => {
      if (e.features.length > 0) {
        // The features in the collection are sorted, so top item will be
        // first in the array
        const topFeature = e.features[0];
        const featureCollection = map.getSource(MAP_SOURCES.SUBURBS).serialize()
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

    map.on('load', resolve);
  });
