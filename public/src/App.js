import React from 'react';
import PropTypes from 'prop-types';
import { collect } from 'react-recollect';
import mapboxgl from 'mapbox-gl';
import * as cabService from './cabService';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';
import * as geoUtils from './utils/geoUtils';
import * as logUtils from './utils/logUtils';
import * as questionUtils from './utils/questionUtils';

class App extends React.PureComponent {
  handleResponse = ({ clickedFeature, clickCoords } = {}) => {
    const { store } = this.props;
    if (!store.isAwaitingAnswer) return;

    store.showNoIdeaButton = false;
    store.showNextButton = true;
    store.isAwaitingAnswer = false;

    const { score, nextAskDate } = questionManager.answerQuestion({
      clickCoords,
      clickedFeature,
    });

    let answerText;
    if (score === 1) {
      answerText = 'Correct!';
      mapboxManager.markRight(clickedFeature.id);
    } else {
      if (clickedFeature) {
        mapboxManager.markWrong(clickedFeature.id);
      }

      if (score === 0) {
        if (clickedFeature) {
          answerText = 'Wrong.';
        } else {
          answerText = 'Now you know.';
        }
      } else if (score < 0.6) {
        answerText = 'Wrong, but could be wronger.';
      } else if (score < 0.8) {
        answerText = 'Wrong, but close.';
      } else {
        answerText = 'Wrong, but very close!';
      }

      const rightAnswer = questionManager.getCurrentQuestion();
      mapboxManager.markRight(rightAnswer.id);
      mapboxManager.addPopup({
        lngLat: geoUtils.getTopPoint(rightAnswer),
        text: rightAnswer.properties.name,
      });
    }

    store.statsText = questionManager.getPageStats();
    store.currentQuestion = null;
    store.answerText = answerText;
    store.nextDuration = questionUtils.getDateTimeAsWords(nextAskDate);
  };

  askNextQuestion = () => {
    const { store } = this.props;
    store.showNoIdeaButton = true;
    store.isAwaitingAnswer = true;
    store.showNextButton = false;
    store.answerText = null;
    store.nextDuration = null;
    store.currentQuestion = questionManager.getNextQuestion();

    mapboxManager.clearStatuses();
    mapboxManager.clearPopups();
  };

  handleTouchStart = () => {
    window.removeEventListener('touchstart', this.handleTouchStart);
  };

  componentDidMount = async () => {
    const { store } = this.props;
    // Kick off loading of:
    // * suburb data
    // * history data
    // * the map
    const [questionFeatureCollection, answerHistory] = await Promise.all([
      fetch('data/sydneySuburbs.json').then(response => response.json()),
      cabService.loadAnswerHistory(),
      mapboxManager.init({ onFeatureClick: this.handleResponse }),
    ]);

    logUtils.logTime('Data and map loaded');

    // When all three are ready, render the data to
    // the map and start asking questions
    mapboxManager.addSuburbsLayer(questionFeatureCollection);

    questionManager.init({
      questionFeatureCollection,
      answerHistory,
    });

    store.isReady = true;
    store.statsText = questionManager.getPageStats();
    this.askNextQuestion();
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

    // We want to refresh the stats if the user comes back after a while
    // Particularly on the mobile as an 'installed' app where it doesn't refresh
    window.addEventListener('focus', () => {
      store.statsText = questionManager.getPageStats();
    });

    // Somewhat dodgy logic to prevent the 'focus' ring on the buttons.
    // This is a proxy for 'is a keyboard available',
    // since these users are less unlikely to
    // want the enter/space shortcut of going to the next question.
    window.addEventListener('touchstart', this.handleTouchStart);
  };

  render() {
    const { store } = this.props;

    return (
      <>
        {store.isReady && (
          <div className="question-wrapper">
            <div className="question-name">
              {!!store.currentQuestion && (
                <>Where is {store.currentQuestion.properties.name}?</>
              )}

              {store.answerText}

              {!store.isAwaitingAnswer && (
                <div className="answer-text">
                  Next review {store.nextDuration}
                </div>
              )}
            </div>

            {store.showNoIdeaButton && (
              <button
                autoFocus
                onClick={() => {
                  mapboxManager.panTo(questionManager.getCurrentQuestion());
                  this.handleResponse();
                }}
              >
                No idea
              </button>
            )}

            {store.showNextButton && (
              <button
                autoFocus
                onClick={() => {
                  store.showNextButton = false;
                  this.askNextQuestion();
                }}
              >
                Next question
              </button>
            )}
          </div>
        )}

        <div className="stats">
          {!!store.statsText && (
            <>
              Review now: {store.statsText.now}
              <span className="stats-spacer">|</span>
              Review later: {store.statsText.later}
              <span className="stats-spacer">|</span>
              Unseen: {store.statsText.unseen}
            </>
          )}
        </div>
      </>
    );
  }
}

App.propTypes = {
  store: PropTypes.shape({
    isReady: PropTypes.bool,
    isAwaitingAnswer: PropTypes.bool,
    answerText: PropTypes.string,
    nextDuration: PropTypes.string,
    showNoIdeaButton: PropTypes.bool,
    currentQuestion: PropTypes.object,
    showNextButton: PropTypes.bool,
    statsText: PropTypes.shape({
      now: PropTypes.number.isRequired,
      later: PropTypes.number.isRequired,
      unseen: PropTypes.number.isRequired,
    }),
  }).isRequired,
};

export default collect(App);
