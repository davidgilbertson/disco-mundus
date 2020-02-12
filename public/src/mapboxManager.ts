/**
 * This file looks after loading the map and any map data, including places.
 * Any logic that interacts with the map goes in here
 */
import { Map as MapboxMap, Layer, MapLayerMouseEvent, Popup } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { store } from 'react-recollect';
import { ACCESS_TOKEN, MAP_STYLE } from './constants';
import * as geoUtils from './utils/geoUtils';
import { interpolate, match } from './utils/mapboxLayerHelpers';
import { FeatureStatus, MapLayer, MapSource } from './enums';

type MapboxManagerState = {
  map: MapboxMap;
  lastHoveredFeatureId?: number;
  featuresWithStatus: Map<number, FeatureStatus>;
  popups: Popup[];
};

// Local state for this module
const state: MapboxManagerState = {
  // @ts-ignore - we know that map will be initialised before being referenced
  map: undefined,
  lastHoveredFeatureId: undefined,
  featuresWithStatus: new Map(),
  popups: [],
};

export const panTo = (feature: QuestionFeature) => {
  state.map.panTo(feature.properties.center);
};

export const addPopup = ({
  lngLat,
  text,
}: {
  lngLat: LngLatArray;
  text: string;
}) => {
  state.popups.push(
    new Popup()
      .setLngLat(lngLat)
      .setHTML(text)
      .addTo(state.map)
  );
};

export const clearPopups = () => {
  state.popups.forEach((popup) => popup.remove());
};

export const clearStatus = (featureId: number) => {
  if (!featureId) return;

  state.featuresWithStatus.delete(featureId);

  state.map.removeFeatureState({
    source: MapSource.SUBURBS,
    id: featureId,
  });
};

export const clearStatuses = (statusToClear?: string) => {
  state.featuresWithStatus.forEach((status, featureId) => {
    if (statusToClear && statusToClear !== status) return;

    clearStatus(featureId);
  });
};

// TODO (davidg): could all this be some amazing connection with the store
// using afterChange()?
export const setStatus = ({
  featureId,
  status,
}: {
  featureId: number;
  status: FeatureStatus;
}) => {
  if (!featureId) return;

  state.featuresWithStatus.set(featureId, status);

  state.map.setFeatureState(
    { source: MapSource.SUBURBS, id: featureId },
    { status }
  );
};

export const select = (featureId: number) => {
  setStatus({ featureId, status: FeatureStatus.SELECTED });
};

export const markWrong = (featureId: number) => {
  setStatus({ featureId, status: FeatureStatus.WRONG });
};

export const markRight = (featureId: number) => {
  setStatus({ featureId, status: FeatureStatus.RIGHT });
};

const hover = (featureId: number) => {
  setStatus({ featureId, status: FeatureStatus.HOVERED });
};

export const addSuburbsLayer = (
  suburbsFeatureCollection: QuestionFeatureCollection
) => {
  state.map.addSource(MapSource.SUBURBS, {
    type: 'geojson',
    data: suburbsFeatureCollection,
  });

  state.map.addLayer(
    {
      id: MapLayer.LOCATION_BORDERS,
      source: MapSource.SUBURBS,
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
    state.map.getStyle().layers?.find((item) => item.type === 'line')?.id
  );

  // The highlight state layers go on top of everything
  state.map.addLayer({
    id: MapLayer.LOCATION_HIGHLIGHT_FILL,
    source: MapSource.SUBURBS,
    type: 'fill',
    paint: {
      'fill-color': match({
        state: 'status', // TODO (davidg): states could be enum
        cases: [
          { if: FeatureStatus.WRONG, then: 'rgba(240, 0, 0, 0.2)' },
          { if: FeatureStatus.RIGHT, then: 'rgba(0, 200, 0, 0.2)' },
          { if: FeatureStatus.SELECTED, then: 'rgba(0, 97, 200, 0.1)' },
          { else: 'rgba(0, 0, 0, 0)' }, // not visible
        ],
      }),
    },
  });

  state.map.addLayer({
    id: MapLayer.LOCATION_HIGHLIGHT_LINE,
    source: MapSource.SUBURBS,
    type: 'line',
    paint: {
      'line-color': match({
        state: 'status',
        cases: [
          { if: FeatureStatus.WRONG, then: 'rgb(240, 0, 0)' },
          { if: FeatureStatus.RIGHT, then: 'rgb(0, 200, 0)' },
          { if: FeatureStatus.SELECTED, then: 'rgb(0, 97, 200)' },
          { if: FeatureStatus.HOVERED, then: 'rgb(255, 255, 255)' },
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

export const bindEvents = (handleUserAction: (props: MapTapData) => void) => {
  state.map.on('mouseenter', MapLayer.LOCATION_HIGHLIGHT_FILL, () => {
    state.map.getCanvas().style.cursor = 'pointer';
  });

  state.map.on('mousemove', MapLayer.LOCATION_HIGHLIGHT_FILL, (e) => {
    if (e.features && e.features.length > 0) {
      const thisFeatureId = e.features[0].id as number;
      // If the mouse is still on the same hovered feature, bail
      if (
        state.lastHoveredFeatureId &&
        thisFeatureId === state.lastHoveredFeatureId
      ) {
        return;
      }

      state.lastHoveredFeatureId = thisFeatureId;

      clearStatuses(FeatureStatus.HOVERED);

      // Only if this feature doesn't have some sort of status already, hover it
      if (!state.featuresWithStatus.get(thisFeatureId)) {
        hover(thisFeatureId);
      }
    }
  });

  // When the mouse leaves the layer
  state.map.on('mouseleave', MapLayer.LOCATION_HIGHLIGHT_FILL, () => {
    state.map.getCanvas().style.cursor = '';
    state.lastHoveredFeatureId = undefined;
    clearStatuses(FeatureStatus.HOVERED);
  });

  state.map.on(
    'click',
    MapLayer.LOCATION_HIGHLIGHT_FILL,
    (e: MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const clickedFeature = store.questionFeatures.get(
          e.features[0].id as number
        );
        if (!clickedFeature) return;

        const status = state.featuresWithStatus.get(clickedFeature.id);
        const featureIsAlreadySelected = status === FeatureStatus.SELECTED;

        clearStatuses();
        clearPopups();

        if (featureIsAlreadySelected) {
          hover(clickedFeature.id);
        } else {
          select(clickedFeature.id);

          const lngLat = geoUtils.getTopPoint(clickedFeature);

          if (lngLat) {
            addPopup({
              lngLat,
              text: clickedFeature.properties.name,
            });
          }
        }

        handleUserAction({
          clickCoords: [e.lngLat.lng, e.lngLat.lat],
          clickedFeature,
        });
      }
    }
  );
};

export const onClick = (cb: (e: MapLayerMouseEvent) => void) => {
  state.map.on('click', cb);
};

export const init = async (): Promise<void> =>
  new Promise((resolve) => {
    const SYDNEY_LNG_LAT = {
      lng: 150.95257825424233,
      lat: -33.856237652995084,
    };
    const SYDNEY_WIDTH_KM = 70;

    state.map = new MapboxMap({
      accessToken: ACCESS_TOKEN,
      container: 'map',
      style: MAP_STYLE,
      center: SYDNEY_LNG_LAT,
      zoom: geoUtils.getZoomToFit({
        kms: SYDNEY_WIDTH_KM,
        lat: SYDNEY_LNG_LAT.lat,
      }),
    });

    window.DM_MAP = state.map;

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Escape') {
        clearStatuses(FeatureStatus.SELECTED);
        clearPopups();
      }
    });

    state.map.on('load', resolve);
  });
