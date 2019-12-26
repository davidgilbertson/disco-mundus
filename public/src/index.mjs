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
    } else if (score < 0.4) {
      questionText = 'Wrong, but in the general vicinity.';
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
  const URL_PARAM_STRING = 'your-progress-id';

  const url = new URL(document.location);
  const id = url.searchParams.get(URL_PARAM_STRING);

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
    url.searchParams.set(URL_PARAM_STRING, response.id);
    window.history.replaceState('', null, url.href);

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

  askNextQuestion();
})();

