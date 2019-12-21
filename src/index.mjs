import * as mapbox from './mapbox.mjs';
import * as storage from './storage.mjs';
import * as dom from './dom.mjs';
import {distanceToScore, getNextAskDate} from './questions.mjs';

let map;
let currentSuburbIndex = 0;
let isAwaitingAnswer = true;
let suburbs;

const askNextQuestion = () => {
  const suburb = suburbs[currentSuburbIndex];

  mapbox.clearStatuses();
  mapbox.clearPopups();
  dom.setQuestionName(`Where is ${suburb.name}?`);
  dom.hideNextButton();
  dom.showNoIdeaButton();
  dom.showQuestionWrapper();
};

const answerQuestion = answer => {
  const correctEntry = suburbs[currentSuburbIndex];
  let score; // from 0 to 1

  if (!answer) {
    // No answer attempted
    mapbox.clearPopups();
    score = 0;
  } else if (answer.name === correctEntry.name) {
    // Answer is exactly correct
    score = 1;
  } else {
    // Answer is maybe close, maybe way off. Calculate...
    score = distanceToScore(answer.lngLat, correctEntry.center);
    console.log('>  index.mjs:36 > answerQuestion > score', score);

    mapbox.markWrong(answer.id);
  }

  // If not the correct answer...
  if (score !== 1) {
    mapbox.select(correctEntry.id);

    mapbox.addPopup({lngLat: correctEntry.center, text: correctEntry.name});
  }

  isAwaitingAnswer = false;
  dom.hideNoIdeaButton();
  dom.showNextButton();

  correctEntry.nextAskDate = getNextAskDate({
    question: correctEntry,
    score,
  });

  storage.set('suburbs', suburbs);
};

dom.onNoIdeaClick(() => {
  answerQuestion(null);
});

dom.onClickNextButton(() => {
  isAwaitingAnswer = true;
  currentSuburbIndex++;
  dom.hideNextButton();

  askNextQuestion();
});

const onMapLoad = data => {
  // map.setPaintProperty('settlement-label', 'text-opacity', 0); // big places
  // map.setPaintProperty('settlement-subdivision-label', 'text-opacity', 0); // suburbs

  suburbs = storage.get('suburbs');

  if (!suburbs) {
    suburbs = data.features.map(feature => ({
      id: feature.id,
      name: feature.properties.name,
      center: feature.properties.center,
      lastIntervalDays: 2,
      nextAskDate: null,
    }));

    storage.set('suburbs', suburbs);
  }

  const now = Date.now();
  suburbs = suburbs.filter(suburb => !suburb.nextAskDate || suburb.nextAskDate < now);
  suburbs.sort((a, b) => {
    if (!a.nextAskDate) return 1;
    if (!b.nextAskDate) return -1;
    return a.nextAskDate - b.nextAskDate;
  });


  askNextQuestion();
};

const onFeatureClick = ({feature, lngLat}) => {
  if (isAwaitingAnswer) {
    answerQuestion({
      id: feature.id, // TODO (davidg): do this better
      name: feature.properties.name,
      lngLat,
    });
  }
};

map = mapbox.init({
  onLoad: onMapLoad,
  onFeatureClick,
});
