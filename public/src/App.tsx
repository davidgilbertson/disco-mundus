import React from 'react';
import { collect, WithStoreProp } from 'react-recollect';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';
import { DisplayPhase } from './enums';
import { getPageStats } from './selectors/selectors';

const App = ({ store }: WithStoreProp) => {
  if (!store.displayPhase) return null;

  const stats = getPageStats(store);

  return (
    <>
      {!!store.displayPhase && (
        <div className="question-wrapper">
          {store.displayPhase === DisplayPhase.QUESTION && (
            <>
              <div>Where is {store.currentQuestion?.properties.name}?</div>

              <button
                className="button"
                autoFocus
                onClick={() => {
                  mapboxManager.panTo(store.currentQuestion);
                  questionManager.handlePlaceTap();
                }}
              >
                No idea
              </button>
            </>
          )}

          {store.displayPhase === DisplayPhase.ANSWER && (
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
                  questionManager.selectNextQuestion();
                }}
              >
                Next question
              </button>
            </>
          )}

          {store.displayPhase === DisplayPhase.NO_QUESTIONS && (
            <div>No more questions</div>
          )}
        </div>
      )}

      <div className="stats-wrapper">
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

export default collect(App);
