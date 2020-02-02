import mapboxgl from 'mapbox-gl';
import * as cabService from './cabService';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';
import * as logUtils from './utils/logUtils';

/** @returns {void} */
const init = async () => {
  // Kick off loading of:
  // * suburb data
  // * history data
  // * the map
  const [questionFeatureCollection, answerHistory] = await Promise.all([
    fetch('data/sydneySuburbs.json').then(response => response.json()),
    cabService.loadAnswerHistory(),
    mapboxManager.init({ onFeatureClick: questionManager.handleUserAction }),
  ]);

  logUtils.logTime('Data and map loaded');

  // When all three are ready, render the data to
  // the map and start asking questions
  mapboxManager.addSuburbsLayer(questionFeatureCollection);

  questionManager.init({
    questionFeatureCollection,
    answerHistory,
  });

  questionManager.askNextQuestion();
  logUtils.logTime('App ready');

  // Clicking on my house shows stats
  mapboxManager.onClick(e => {
    const myHouseBounds = new mapboxgl.LngLatBounds([
      { lng: 151.07749659127188, lat: -33.82599275017796 },
      { lng: 151.0783350111576, lat: -33.825089019351836 },
    ]);

    if (myHouseBounds.contains(e.lngLat)) {
      logUtils.getAppInfo().then(window.alert);
    }
  });
};

export default init;
