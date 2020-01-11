import * as cabService from './cabService.mjs';
import * as dom from './dom.mjs';
import * as geoUtils from './utils/geoUtils.mjs';
import * as mapboxManager from './mapboxManager.mjs';
import * as questionManager from './questionManager.mjs';
import * as questionUtils from './utils/questionUtils.mjs';

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
const handleResponse = ({ clickedFeature, clickCoords } = {}) => {
  if (!isAwaitingAnswer) return;

  isAwaitingAnswer = false;
  dom.hideNoIdeaButton();
  dom.showNextButton();

  const { score, nextAskDate } = questionManager.answerQuestion({
    clickCoords,
    clickedFeature,
  });

  let questionText;
  if (score === 1) {
    questionText = 'Correct!';
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
      text: rightAnswer.properties.name,
    });
  }

  const nextDuration = questionUtils.getIntervalAsWords(
    nextAskDate - Date.now()
  );
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

(async () => {
  // Kick off loading of:
  // * suburb data
  // * history data
  // * the map
  const [questionFeatureCollection, historyData] = await Promise.all([
    fetch('data/sydneySuburbs.json').then(response => response.json()),
    cabService.loadAnswerHistory(),
    mapboxManager.init({ onFeatureClick: handleResponse }),
  ]);

  // When all three are ready, render the data to
  // the map and start asking questions
  mapboxManager.addSuburbsLayer(questionFeatureCollection);

  // Clicking on my house shows stats
  mapboxManager.onClick(e => {
    const myHouseBounds = new mapboxgl.LngLatBounds([
      { lng: 151.07749659127188, lat: -33.82599275017796 },
      { lng: 151.0783350111576, lat: -33.825089019351836 },
    ]);

    if (myHouseBounds.contains(e.lngLat)) {
      questionManager.generateAndPrintStats(true);
    }
  });

  questionManager.init({
    questionFeatureCollection,
    answerHistory: historyData.answerHistory,
    userId: historyData.userId,
  });

  dom.setStatsText(questionManager.getPageStats());
  askNextQuestion();

  // We want to refresh the stats if the user comes back after a while
  // Particularly on the mobile as an 'installed' app where it doesn't refresh
  window.addEventListener('focus', () => {
    dom.setStatsText(questionManager.getPageStats());
  });
})();
