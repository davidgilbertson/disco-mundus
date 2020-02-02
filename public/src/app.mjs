import React from 'react';
import mapboxgl from 'mapbox-gl';
import * as cabService from './cabService.mjs';
import * as mapboxManager from './mapboxManager.mjs';
import * as questionManager from './questionManager.mjs';
import * as geoUtils from './utils/geoUtils.mjs';
import * as logUtils from './utils/logUtils.mjs';
import * as questionUtils from './utils/questionUtils.mjs';

class App extends React.PureComponent {
  state = {
    isReady: false,
    showNoIdeaButton: false,
    showNextButton: false,
    showQuestion: false,
    currentQuestion: null,
    statsText: null,
    isAwaitingAnswer: false,
    answerText: null,
  };

  handleResponse = ({ clickedFeature, clickCoords } = {}) => {
    if (!this.state.isAwaitingAnswer) return;

    this.setState({
      isAwaitingAnswer: false,
      showNoIdeaButton: false,
      showNextButton: true,
    });

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

    this.setState({
      nextDuration: questionUtils.getDateTimeAsWords(nextAskDate),
      answerText,
      statsText: questionManager.getPageStats(),
      currentQuestion: null,
    });
  };

  askNextQuestion = () => {
    this.setState({
      isAwaitingAnswer: true,
      answerText: null,
      nextDuration: null,
      currentQuestion: questionManager.getNextQuestion(),
      showNoIdeaButton: true,
      showNextButton: false,
    });

    mapboxManager.clearStatuses();
    mapboxManager.clearPopups();
  };

  handleTouchStart = () => {
    this.setState({ isTouch: true });
    window.removeEventListener('touchstart', this.handleTouchStart);
  };

  componentDidMount = async () => {
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

    this.setState({
      statsText: questionManager.getPageStats(),
      isReady: true,
    });
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
      this.setState({ statsText: questionManager.getPageStats() });
    });

    // Somewhat dodgy logic to prevent the 'focus' ring on the buttons.
    // This is a proxy for 'is a keyboard available',
    // since these users are less unlikely to
    // want the enter/space shortcut of going to the next question.
    window.addEventListener('touchstart', this.handleTouchStart);
  };

  render() {
    const { state } = this;

    return (
      <>
        <div id="map" />

        {state.isReady && (
          <div className="question-wrapper">
            <div className="question-name">
              {!!state.currentQuestion && (
                <>Where is {state.currentQuestion.properties.name}?</>
              )}

              {state.answerText}

              {!state.isAwaitingAnswer && (
                <div className="answer-text">
                  Next review {state.nextDuration}
                </div>
              )}
            </div>

            {state.showNoIdeaButton && (
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

            {state.showNextButton && (
              <button
                autoFocus
                onClick={() => {
                  this.setState({ showNextButton: false });
                  this.askNextQuestion();
                }}
              >
                Next question
              </button>
            )}
          </div>
        )}

        <div className="stats">
          {!!state.statsText && (
            <>
              Review now: {state.statsText.now}
              <span className="stats-spacer">|</span>
              Review later: {state.statsText.later}
              <span className="stats-spacer">|</span>
              Unseen: {state.statsText.unseen}
            </>
          )}
        </div>
      </>
    );
  }
}

export default App;
