import * as dom from './dom.mjs';
import * as geoUtils from './utils/geoUtils.mjs';
import * as mapboxManager from './mapboxManager.mjs';
import * as questionManager from './questionManager.mjs';
import * as questionUtils from './utils/questionUtils.mjs';
import cabService from './cabService.mjs';

let isAwaitingAnswer = false;

const askNextQuestion = () => {
  isAwaitingAnswer = true;
  const nextQuestion = questionManager.getNextQuestion();

  mapboxManager.clearStatuses();
  mapboxManager.clearPopups();

  dom.setQuestionNameInnerHTML(`Where is ${nextQuestion.properties.name}?`);

  dom.hideNextButton();
  dom.showNoIdeaButton();
  dom.showQuestionWrapper();
};

// Update the UI based on the response
const handleResponse = ({clickedFeature, clickCoords} = {}) => {
  if (!isAwaitingAnswer) return;

  isAwaitingAnswer = false;
  dom.hideNoIdeaButton();
  dom.showNextButton();

  const {score, nextAskDate} = questionManager.answerQuestion({clickCoords, clickedFeature});

  let questionText;
  if (score === 1) {
    questionText = `Correct!`;
    mapboxManager.markRight(clickedFeature.id);
  } else {
    if (clickedFeature) {
      mapboxManager.markWrong(clickedFeature.id);
    }

    if (score === 0) {
      if (clickedFeature) {
        questionText = 'Wrong.';
      } else {
        questionText = 'Now you know.';
      }
    } else if (score < 0.6) {
      questionText = 'Wrong, but could be wronger.';
    } else if (score < 0.8) {
      questionText = 'Wrong, but close.';
    } else {
      questionText = 'Wrong, but very close!';
    }

    const rightAnswer = questionManager.getCurrentQuestion();
    mapboxManager.markRight(rightAnswer.id);
    mapboxManager.addPopup({
      lngLat: geoUtils.getTopPoint(rightAnswer),
      text: rightAnswer.properties.name
    });
  }

  const nextDuration = questionUtils.getIntervalAsWords(nextAskDate - Date.now());
  questionText += `
    <br>
    <small>
      Next review in ${nextDuration}
    </small>
  `;

  dom.setQuestionNameInnerHTML(questionText);

  dom.setStatsText(questionManager.getPageStats());
};

dom.onClickNoIdeaButton(() => {
  mapboxManager.panTo(questionManager.getCurrentQuestion());
  handleResponse();
});

dom.onClickNextButton(() => {
  dom.hideNextButton();

  askNextQuestion();
});

const getOrCreateHistory = async () => {
  // Changing this string would break progress for all users. So don't do that.
  const PROGRESS_ID_STRING = 'your-progress-id';

  // Get the ID from the URL
  const url = new URL(document.location);
  let id = url.searchParams.get(PROGRESS_ID_STRING);

  // Or if none, try local storage
  if (!id) {
    id = localStorage.getItem(PROGRESS_ID_STRING);

    // So, the ID wasn't in the URL but was in storage. So put it in the URL
    if (id) {
      url.searchParams.set(PROGRESS_ID_STRING, id);
      window.history.replaceState('', null, url.href);
    }
  } else {
    // If it was in the URL, put it in storage too
    // We want this in LS because the 'installed' version of the site
    // won't have the URL param
    localStorage.setItem(PROGRESS_ID_STRING, id);
  }

  if (id) {
    const response = await cabService.read(id);

    if (!response.error) {
      return {
        answerHistory: response.data.answerHistory,
        id: id,
      };
    }

    console.error('Seems like that was a bad ID.', response.error);
  }

  // There was no ID, or a bad ID, so create a new session
  const response = await cabService.create({answerHistory: []});

  if (!response.error) {
    // We've got a new ID, put it in the URL
    url.searchParams.set(PROGRESS_ID_STRING, response.id);
    window.history.replaceState('', null, url.href);

    // And LS too, for good measure
    localStorage.setItem(PROGRESS_ID_STRING, response.id);

    return {
      answerHistory: [],
      id: response.id,
    };
  }

  console.error('Could not create a new session.', response.error);

  throw Error('Something has gone terribly wrong');
};

(async () => {
  // Kick off loading of:
  // * suburb data
  // * history data
  // * the map
  const [questionFeatureCollection, historyData] = await Promise.all([
    fetch('data/sydneySuburbs.json').then(response => response.json()),
    getOrCreateHistory(),
    mapboxManager.init({onFeatureClick: handleResponse}),
  ]);

  // When all three are ready, render the data to the map and start asking questions
  mapboxManager.addSuburbsLayer(questionFeatureCollection);

  // Clicking on my house shows stats
  mapboxManager.onClick(e => {
    const myHouseBounds = new mapboxgl.LngLatBounds([
      {lng: 151.07749659127188, lat: -33.82599275017796},
      {lng: 151.0783350111576, lat: -33.825089019351836}
    ]);

    if (myHouseBounds.contains(e.lngLat)) questionManager.generateAndPrintStats(true);
  });

  questionManager.init(({
    questionFeatureCollection,
    answerHistory: historyData.answerHistory,
    id: historyData.id,
  }));

  dom.setStatsText(questionManager.getPageStats());
  askNextQuestion();

  // We want to refresh the stats if the user comes back after a while
  // Particularly on the mobile as an 'installed' app where it doesn't refresh
  window.addEventListener('focus', () => {
    dom.setStatsText(questionManager.getPageStats());
  });
})();
