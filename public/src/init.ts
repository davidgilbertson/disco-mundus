import { LngLatBounds } from 'mapbox-gl';
import { store } from 'react-recollect';
import * as cabService from './cabService';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';
import * as logUtils from './utils/logUtils';

const init = async (): Promise<void> => {
  // Initialise the store with defaults
  store.isSignificantSession = false;
  store.questionFeatures = new Map();
  store.sessionQueue = new Set();
  store.sessionStats = {
    WRONG: { name: 'Wrong', count: 0 },
    CLOSE: { name: 'Close', count: 0 },
    RIGHT: { name: 'Right', count: 0 },
  };

  window.DM_STORE = store;

  // Kick off loading of:
  // * place data
  // * history data
  // * the map
  const [questionFeatureCollection, answerHistory] = await Promise.all<
    QuestionFeatureCollection,
    AnswerHistory,
    void
  >([
    fetch('data/sydneySuburbs.json').then((response) => response.json()),
    cabService.loadAnswerHistory(),
    mapboxManager.init(),
  ]);

  logUtils.logTime('Data and map loaded');

  // When all three are ready, render the data to
  // the map and start asking questions
  mapboxManager.addMapData(questionFeatureCollection);
  questionManager.init(questionFeatureCollection, answerHistory);
  mapboxManager.bindEvents(questionManager.handlePlaceTap);

  questionManager.selectNextQuestion();
  logUtils.logTime('App ready');

  // Clicking on my house shows stats
  mapboxManager.onClick((e) => {
    const myHouseBounds = new LngLatBounds([
      { lng: 151.07749659127188, lat: -33.82599275017796 },
      { lng: 151.0783350111576, lat: -33.825089019351836 },
    ]);

    if (myHouseBounds.contains(e.lngLat)) {
      logUtils.getAppInfo().then((info) => {
        if (info) window.alert(info);
      });
    }
  });
};

export default init;
