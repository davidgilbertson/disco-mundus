import { store } from 'react-recollect';
import * as cabService from './cabService';
import * as mapboxManager from './mapboxManager';
import * as dataUtils from './utils/dataUtils';
import * as geoUtils from './utils/geoUtils';
import * as questionUtils from './utils/questionUtils';
import { DMSR } from './constants';
import { DisplayPhase } from './enums';

// TODO (davidg): just update this where I work the score out?
const updateSessionStats = (score: number) => {
  if (score === 0) {
    store.sessionStats.WRONG.count++;
  } else if (score < 1) {
    store.sessionStats.CLOSE.count++;
  } else {
    store.sessionStats.RIGHT.count++;
  }
};

const populateQueueWithNewQuestions = () => {
  const arrayClone = Array.from(store.questionFeatures.values());

  // TODO (davidg): this should also get questions with nextAskDate <
  //  the threshold.
  // Get a random selection of questions
  while (store.sessionQueue.size < DMSR.SESSION_SIZE && arrayClone.length) {
    const randomIndex = Math.round(Math.random() * (arrayClone.length - 1));
    const feature = arrayClone.splice(randomIndex, 1)[0];

    if (!feature.properties.nextAskDate) {
      store.sessionQueue.add(feature.id);
    }
  }
};

/**
 * Mixes question features and answer history
 */
export const init = (
  questionFeatureCollection: QuestionFeatureCollection,
  answerHistory: AnswerHistory
) => {
  // TODO (davidg): I want to separate this into init() and update()
  //  I think that's just taking the loop of questions and iterating again
  //  this should add to the session Set() nicely
  const answerHistoryMap = dataUtils.arrayToMap(answerHistory);

  const reviewCutoff = questionUtils.getReviewCutoff();

  questionFeatureCollection.features.forEach((feature) => {
    const matchingHistoryItem: AnswerHistoryItem = (answerHistoryMap.get(
      feature.id
    ) || {}) as AnswerHistoryItem;

    if (
      matchingHistoryItem.nextAskDate &&
      matchingHistoryItem.nextAskDate < reviewCutoff
    ) {
      store.sessionQueue.add(feature.id);
    }

    const questionFeature = dataUtils.updateFeatureProps(feature, {
      nextAskDate: matchingHistoryItem.nextAskDate,
      lastAskDate: matchingHistoryItem.lastAskDate,
      lastScore: matchingHistoryItem.lastScore,
    });

    store.questionFeatures.set(feature.id, questionFeature);
  });

  if (!store.sessionQueue.size) {
    populateQueueWithNewQuestions();
  } else if (store.sessionQueue.size > 10) {
    // Later, we'll tell the user they're finished reviewing
    // We only bother if they've got quite a few to do
    store.isSignificantSession = true;
  }

  // TODO (davidg): if there are still none, there's nothing left to learn.
  //  The UI should reflect this
};

/**
 * Update the local question set and save the results to the database
 */
const updateAnswerHistory = (score: number, nextAskDate: number) => {
  // For the first answer each session record the score in session stats
  if (!store.currentQuestion.properties.answeredThisSession) {
    updateSessionStats(score);
  }

  const newProps = {
    lastAskDate: Date.now(),
    lastScore: score,
    nextAskDate,
    answeredThisSession: true, // this is never saved
  };

  const newQuestionFeature = dataUtils.updateFeatureProps(
    store.currentQuestion,
    newProps
  );

  store.questionFeatures.set(store.currentQuestion.id, newQuestionFeature);

  cabService.saveAnswer(newQuestionFeature);

  const reviewCutoff = questionUtils.getReviewCutoff();

  if (nextAskDate > reviewCutoff) {
    // This question is far enough in the future. Stop asking.
    store.sessionQueue.delete(store.currentQuestion.id);

    // If this was the last item in the queue ...
    if (!store.sessionQueue.size) {
      populateQueueWithNewQuestions();

      if (store.isSignificantSession) {
        store.isSignificantSession = false;

        setTimeout(() => {
          window.alert(
            [
              `You've finished your reviews!`,
              '-----------------------------',
              questionUtils.getSessionStatsAsString(store.sessionStats),
              '-----------------------------',
              `Queueing up ${DMSR.SESSION_SIZE} new questions.`,
            ].join('\n')
          );
        });
      }
    }
  }
};

// TODO (davidg): is this really 'selectNextQuestion'?
export const askNextQuestion = () => {
  // Start with the first one.
  let firstQuestionId: number = store.sessionQueue.values().next().value;
  let nextReviewQuestion = store.questionFeatures.get(firstQuestionId);

  // TODO (davidg): handle no more questions.
  if (!nextReviewQuestion) return;

  // It is assumed that if a question in the queue, it's ready to be asked
  store.sessionQueue.forEach((questionId) => {
    const question = store.questionFeatures.get(questionId);
    if (!question) return;

    if (
      !question.properties.nextAskDate || // Prefer brand new questions
      question.properties.nextAskDate <
        nextReviewQuestion!.properties.nextAskDate
    ) {
      nextReviewQuestion = question;
    }
  });

  store.currentQuestion = nextReviewQuestion;

  store.displayPhase = DisplayPhase.QUESTION;
};

/**
 * Could be called when the user clicks the map or clicks the 'No idea' button
 */
export const handleUserAction = (
  { clickCoords, clickedFeature }: MapTapData = {} as MapTapData
) => {
  if (store.displayPhase === DisplayPhase.ANSWER) return;

  let score; // from 0 to 1

  if (!clickedFeature) {
    // No answer attempted
    score = 0;
  } else if (
    clickedFeature.properties.name === store.currentQuestion.properties.name
  ) {
    // Answer is exactly correct
    score = 1;
  } else {
    // Base the score on how close the guess was
    score = questionUtils.calculateAnswerScore({
      clickCoords,
      correctQuestionFeature: store.currentQuestion,
      clickedQuestionFeature: clickedFeature,
    });
  }

  const nextAskDate = questionUtils.getNextAskDate({
    question: store.currentQuestion,
    score,
  });

  updateAnswerHistory(score, nextAskDate);

  let answerText;
  if (score === 1) {
    answerText = 'Correct!';
    // TODO (davidg): I don't love that this module talks directly to the map
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

    mapboxManager.markRight(store.currentQuestion.id);

    const lngLat = geoUtils.getTopPoint(store.currentQuestion);

    if (lngLat) {
      mapboxManager.addPopup({
        lngLat,
        text: store.currentQuestion.properties.name,
      });
    }
  }

  store.answer = {
    text: answerText,
    nextAskDate: questionUtils.getDateTimeAsWords(nextAskDate),
  };

  store.displayPhase = DisplayPhase.ANSWER;
};

export const getPageStats = () => {
  const now = store.sessionQueue.size;
  let unseen = 0;

  store.questionFeatures.forEach((feature) => {
    const isInQueue = store.sessionQueue.has(feature.id);

    if (!feature.properties.nextAskDate && !isInQueue) {
      unseen++;
    }
  });

  const later = store.questionFeatures.size - unseen - now;

  return { now, later, unseen };
};
