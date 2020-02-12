import React from 'react';
import { collect, Store } from 'react-recollect';
import * as mapboxManager from './mapboxManager';
import * as questionManager from './questionManager';
import { DisplayPhase } from './enums';

const App = ({ store }: { store: Store }) => {
  if (!store.displayPhase) return null;

  const stats = questionManager.getPageStats();

  return (
    <>
      {!!store.displayPhase && (
        <div className="question-wrapper">
          {store.displayPhase === DisplayPhase.QUESTION && (
            <>
              <div>Where is {store.currentQuestion?.properties.name} ?</div>

              <button
                className="button"
                autoFocus
                onClick={() => {
                  mapboxManager.panTo(store.currentQuestion);
                  questionManager.handleUserAction();
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
                  questionManager.askNextQuestion();
                }}
              >
                Next question
              </button>
            </>
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
