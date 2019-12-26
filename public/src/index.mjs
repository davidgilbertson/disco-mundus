import * as dom from './dom.mjs';
import * as geoUtils from './geoUtils.mjs';
import * as mapbox from './mapbox.mjs';
import * as questions from './questions.mjs';
import * as utils from './utils.mjs';
import cab from './cab.mjs';

let isAwaitingAnswer = false;

const askNextQuestion = () => {
  isAwaitingAnswer = true;
  const nextQuestion = questions.getNextQuestion();

  mapbox.clearStatuses();
  mapbox.clearPopups();

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

  const {score, nextAskDate} = questions.answerQuestion({clickCoords, clickedFeature});

  let questionText = '';
  if (score === 1) {
    questionText = `Correct!`;
    mapbox.markRight(clickedFeature.id);
  } else {
    if (clickedFeature) {
      mapbox.markWrong(clickedFeature.id);
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

    const rightAnswer = questions.getCurrentQuestion();
    mapbox.markRight(rightAnswer.id);
    mapbox.addPopup({
      lngLat: geoUtils.getTopPoint(rightAnswer),
      text: rightAnswer.properties.name
    });
  }

  const nextDuration = utils.getIntervalAsWords(nextAskDate - Date.now());
  questionText += `
    <br>
    <small>
      Next review in ${nextDuration}
    </small>
  `;

  dom.setQuestionNameInnerHTML(questionText);

  dom.setStatsText(questions.getStats());
};

dom.onClickNoIdeaButton(() => {
  mapbox.panTo(questions.getCurrentQuestion());
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
    const response = await cab.read(id);

    if (!response.error) {
      return {
        answerHistory: response.answerHistory,
        id: id,
      };
    }

    console.error('Seems like that was a bad ID.', response.error);
  }

  // There was no ID, or a bad ID, so create a new session
  const response = await cab.create({answerHistory: []});

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
    fetch('data/questionFeatureCollection.json').then(response => response.json()),
    getOrCreateHistory(),
    mapbox.init({onFeatureClick: handleResponse}),
  ]);

  // When all three are ready, render the data to the map and start asking questions
  mapbox.addSuburbsLayer(questionFeatureCollection);
  questions.init(({
    questionFeatureCollection,
    answerHistory: historyData.answerHistory,
    id: historyData.id,
  }));

  dom.setStatsText(questions.getStats());
  askNextQuestion();
})();

