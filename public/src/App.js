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

const DISPLAY = {
  QUESTION: 'QUESTION',
  ANSWER: 'ANSWER',
};

class App extends React.PureComponent {
  handleResponse = ({ clickedFeature, clickCoords } = {}) => {
    const { store } = this.props;
    if (store.display === DISPLAY.ANSWER) return;

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

    store.answer = {
      text: answerText,
      nextAskDate: questionUtils.getDateTimeAsWords(nextAskDate),
    };

    store.display = DISPLAY.ANSWER;
  };

  askNextQuestion = () => {
    const { store } = this.props;

    store.currentQuestion = questionManager.getNextQuestion();
    store.display = DISPLAY.QUESTION;

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

    // Somewhat dodgy logic to prevent the 'focus' ring on the buttons.
    // This is a proxy for 'is a keyboard available',
    // since these users are less unlikely to
    // want the enter/space shortcut of going to the next question.
    window.addEventListener('touchstart', this.handleTouchStart);
  };

  render() {
    const { store } = this.props;

    const stats = questionManager.getPageStats();

    return (
      <>
        {store.isReady && (
          <div className="question-wrapper">
            {store.display === DISPLAY.QUESTION && (
              <>
                <div>Where is {store.currentQuestion?.properties.name}?</div>

                <button
                  className="button"
                  autoFocus
                  onClick={() => {
                    mapboxManager.panTo(questionManager.getCurrentQuestion());
                    this.handleResponse();
                  }}
                >
                  No idea
                </button>
              </>
            )}

            {store.display === DISPLAY.ANSWER && (
              <>
                {store.answer.text}

                <div className="next-ask-date">
                  Next review {store.answer.nextAskDate}
                </div>

                <button
                  className="button"
                  autoFocus
                  onClick={this.askNextQuestion}
                >
                  Next question
                </button>
              </>
            )}
          </div>
        )}

        <div className="stats">
          {!!stats && (
            <>
              Review now: {stats.now}
              <span className="stats-spacer">|</span>
              Review later: {stats.later}
              <span className="stats-spacer">|</span>
              Unseen: {stats.unseen}
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
    display: PropTypes.oneOf(Object.values(DISPLAY)),
    answer: PropTypes.shape({
      text: PropTypes.string,
      nextAskDate: PropTypes.string,
    }),
    currentQuestion: PropTypes.object,
  }).isRequired,
};

export default collect(App);
