import * as cabService from './cabService.mjs';
import * as dataUtils from './utils/dataUtils.mjs';
import * as questionUtils from './utils/questionUtils.mjs';
import { DMSR } from './constants.mjs';

/**
 * @typedef {number} DateTimeMillis - the date/time in
 *   milliseconds since the epoch
 */

/**
 * It seems that extending Feature doesn't allow overwriting
 * the properties object, so this
 * creates a new definition and sets id/geometry manually
 *
 * @typedef QuestionFeature
 * @property {number} id
 * @property {object} properties
 * @property {string} properties.name
 * @property {Coords} properties.center
 * @property {DateTimeMillis} [properties.nextAskDate]
 * @property {DateTimeMillis} [properties.lastAskDate]
 * @property {number} [properties.lastScore] - the score, between 0 and 1
 * @property {Feature.geometry} geometry
 */

const state = {
  /** @type {Map<number, QuestionFeature>} */
  questionFeatures: new Map(),

  /** @type {?QuestionFeature} */
  currentQuestion: null,

  /**
   * A set of IDs that make up the current session's questions
   * @type {Set<number>}
   */
  sessionQueue: new Set(),

  /**
   * We'll show an modal after finishing a review session
   * @type {boolean}
   */
  isSignificantSession: false,

  sessionStats: {
    WRONG: { name: 'Wrong', count: 0 },
    CLOSE: { name: 'Close', count: 0 },
    RIGHT: { name: 'Right', count: 0 },
  },
};

window.DM_STATE = state;

/**
 * @return {QuestionFeature}
 */
export const getCurrentQuestion = () => state.currentQuestion;

const updateSessionStats = score => {
  if (score === 0) {
    state.sessionStats.WRONG.count++;
  } else if (score < 1) {
    state.sessionStats.CLOSE.count++;
  } else {
    state.sessionStats.RIGHT.count++;
  }
};

/** @return {void} */
const populateQueueWithNewQuestions = () => {
  const arrayClone = Array.from(state.questionFeatures.values());

  // TODO (davidg): this should also get questions with nextAskDate <
  //  the threshold.
  // Get a random selection of questions
  while (state.sessionQueue.size < DMSR.SESSION_SIZE && arrayClone.length) {
    const randomIndex = Math.round(Math.random() * (arrayClone.length - 1));
    const feature = arrayClone.splice(randomIndex, 1)[0];

    if (!feature.properties.nextAskDate) {
      state.sessionQueue.add(feature.id);
    }
  }
};

/**
 * Mixes question features and answer history
 * Doesn't return. Question features can be accessed with getNextQuestion()
 *
 * @param {object} props
 * @param {{features: Array<QuestionFeature>}} props.questionFeatureCollection
 * @param {AnswerHistory} props.answerHistory
 */
export const init = ({ questionFeatureCollection, answerHistory }) => {
  // TODO (davidg): I want to separate this into init() and update()
  //  I think that's just taking the loop of questions and iterating again
  //  this should add to the session Set() nicely
  const answerHistoryMap = dataUtils.arrayToMap(answerHistory);

  const reviewCutoff = questionUtils.getReviewCutoff();

  questionFeatureCollection.features.forEach(feature => {
    const matchingHistoryItem = answerHistoryMap.get(feature.id) || {};

    if (
      matchingHistoryItem.nextAskDate &&
      matchingHistoryItem.nextAskDate < reviewCutoff
    ) {
      state.sessionQueue.add(feature.id);
    }

    const questionFeature = dataUtils.updateFeatureProps(feature, {
      nextAskDate: matchingHistoryItem.nextAskDate,
      lastAskDate: matchingHistoryItem.lastAskDate,
      lastScore: matchingHistoryItem.lastScore,
    });

    state.questionFeatures.set(feature.id, questionFeature);
  });

  if (!state.sessionQueue.size) {
    populateQueueWithNewQuestions();
  } else {
    // Later, we'll tell the user they're finished reviewing
    // We only bother if they've got quite a few to do
    if (state.sessionQueue.size > 10) {
      state.isSignificantSession = true;
    }
  }

  // TODO (davidg): if there are still none, there's nothing left to learn.
  //  The UI should reflect this
};

/**
 * Update the local question set and save the results to the database
 *
 * @param {number} score
 * @param {DateTimeMillis} nextAskDate
 * @return {void}
 */
const updateAnswerHistory = ({ score, nextAskDate }) => {
  // For the first answer each session record the score in session stats
  if (!state.currentQuestion.properties.answeredThisSession) {
    updateSessionStats(score);
  }

  const newProps = {
    lastAskDate: Date.now(),
    lastScore: score,
    nextAskDate,
    answeredThisSession: true, // this is never saved
  };

  const newQuestionFeature = dataUtils.updateFeatureProps(
    state.currentQuestion,
    newProps
  );

  state.questionFeatures.set(state.currentQuestion.id, newQuestionFeature);

  cabService.saveAnswer(newQuestionFeature);

  const reviewCutoff = questionUtils.getReviewCutoff();

  if (nextAskDate > reviewCutoff) {
    // This question is far enough in the future. Stop asking.
    state.sessionQueue.delete(state.currentQuestion.id);

    // If this was the last item in the queue ...
    if (!state.sessionQueue.size) {
      populateQueueWithNewQuestions();

      if (state.isSignificantSession) {
        state.isSignificantSession = false;

        setTimeout(() => {
          window.alert(
            [
              `You've finished your reviews!`,
              '-----------------------------',
              questionUtils.getSessionStatsAsString(state.sessionStats),
              '-----------------------------',
              `Queueing up ${DMSR.SESSION_SIZE} new questions.`,
            ].join('\n')
          );
        });
      }
    }
  }
};

/**
 * Returns the next question due to be reviewed from the queue.
 * Prefers new questions if there are any, else will review those in
 * the queue
 *
 * @return {QuestionFeature} - the next appropriate question
 */
export const getNextQuestion = () => {
  let nextReviewQuestion;

  // It is assumed that if a question in the queue, it's ready to be asked
  state.sessionQueue.forEach(questionId => {
    const question = state.questionFeatures.get(questionId);

    if (
      !nextReviewQuestion || // first loop
      !question.properties.nextAskDate || // Prefer brand new questions
      question.properties.nextAskDate <
        nextReviewQuestion.properties.nextAskDate
    ) {
      nextReviewQuestion = question;
    }
  });

  if (!nextReviewQuestion) {
    throw Error('This should not be possible.');
  }

  state.currentQuestion = nextReviewQuestion;

  return state.currentQuestion;
};

/**
 * @param {object} [props]
 * @param {QuestionFeature} props.clickedFeature
 * @param {Coords} props.clickCoords
 * @return {{score: number, nextAskDate: number}}
 */
export const answerQuestion = ({ clickedFeature, clickCoords } = {}) => {
  let score; // from 0 to 1

  if (!clickedFeature) {
    // No answer attempted
    score = 0;
  } else if (
    clickedFeature.properties.name === state.currentQuestion.properties.name
  ) {
    // Answer is exactly correct
    score = 1;
  } else {
    // Base the score on how close the guess was
    score = questionUtils.calculateAnswerScore({
      clickCoords,
      correctQuestionFeature: state.currentQuestion,
      clickedQuestionFeature: clickedFeature,
    });
  }

  const nextAskDate = questionUtils.getNextAskDate({
    question: state.currentQuestion,
    score,
  });

  updateAnswerHistory({ score, nextAskDate });

  return { score, nextAskDate };
};

/**
 * @return {{now: number, later: number, unseen: number}}
 */
export const getPageStats = () => {
  let now = state.sessionQueue.size;
  let unseen = 0;

  state.questionFeatures.forEach(feature => {
    const isInQueue = state.sessionQueue.has(feature.id);

    if (!feature.properties.nextAskDate && !isInQueue) {
      unseen++;
    }
  });

  const later = state.questionFeatures.size - unseen - now;

  return { now, later, unseen };
};
