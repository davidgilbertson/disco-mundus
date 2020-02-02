import React from 'react';
import PropTypes from 'prop-types';
import { collect } from 'react-recollect';
import { DISPLAY_PHASES } from './constants';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';

const App = ({ store }) => {
  if (!store.displayPhase) return null;

  const stats = questionManager.getPageStats();

  return (
    <>
      <div className="question-wrapper">
        {store.displayPhase === DISPLAY_PHASES.QUESTION && (
          <>
            <div>Where is {store.currentQuestion?.properties.name}?</div>

            <button
              className="button"
              autoFocus
              onClick={() => {
                mapboxManager.panTo(questionManager.getCurrentQuestion());
                questionManager.handleUserAction();
              }}
            >
              No idea
            </button>
          </>
        )}

        {store.displayPhase === DISPLAY_PHASES.ANSWER && (
          <>
            {store.answer.text}

            <div className="next-ask-date">
              Next review {store.answer.nextAskDate}
            </div>

            <button
              className="button"
              autoFocus
              onClick={() => {
                mapboxManager.clearStatuses();
                mapboxManager.clearPopups();
                questionManager.askNextQuestion();
              }}
            >
              Next question
            </button>
          </>
        )}
      </div>

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
};

App.propTypes = {
  store: PropTypes.shape({
    displayPhase: PropTypes.oneOf(Object.values(DISPLAY_PHASES)),
    answer: PropTypes.shape({
      text: PropTypes.string,
      nextAskDate: PropTypes.string,
    }),
    currentQuestion: PropTypes.object,
  }).isRequired,
};

export default collect(App);
