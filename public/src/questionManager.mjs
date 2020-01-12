import * as cabService from './cabService.mjs';
import * as dataUtils from './utils/dataUtils.mjs';
import * as dateTimeUtils from './utils/dateTimeUtils.mjs';
import * as questionUtils from './utils/questionUtils.mjs';
import { DMSR } from './constants.mjs';

/**
 * @typedef AnswerHistoryItem
 * @property {number} id - the feature ID
 * @property {number} lastScore
 * @property {number} nextAskDate - date/time in milliseconds.
 * @property {number} lastAskDate - date/time in milliseconds.
 *    Used to calculate the nextAskDate once a question is answered
 */

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
  /** @type {?string} */
  userId: null,

  /** @type {Map<number, QuestionFeature>} */
  questionFeatures: new Map(),

  /** @type {?QuestionFeature} */
  currentQuestion: null,

  /**
   * A set of IDs that make up the current session's questions
   * @type {Set<number>}
   * */
  sessionQueue: new Set(),

  /** @type {boolean} */
  isReviewingLots: false,
};

/**
 * @return {QuestionFeature}
 */
export const getCurrentQuestion = () => state.currentQuestion;

const populateQueueWithNewQuestions = () => {
  for (const feature of state.questionFeatures.values()) {
    // TODO (davidg): this should actually get questions with nextAskDate <
    //  the threshold. This wouldn't happen on the first fetch of 10, but
    //  would happen on subsequent ones, potentially.
    if (!feature.properties.nextAskDate) {
      state.sessionQueue.add(feature.id);

      if (state.sessionQueue.size === DMSR.SESSION_SIZE) return;
    }
  }
};

/**
 * Mixes question features and answer history
 * Doesn't return. Question features can be accessed with getNextQuestion()
 *
 * @param {object} props
 * @param {string} props.userId
 * @param {{features: Array<QuestionFeature>}} props.questionFeatureCollection
 * @param {Array<AnswerHistoryItem>} props.answerHistory
 */
export const init = ({ userId, questionFeatureCollection, answerHistory }) => {
  state.userId = userId;

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
      state.isReviewingLots = true;
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
  const newProps = {
    lastAskDate: Date.now(),
    lastScore: score,
    nextAskDate,
  };

  state.questionFeatures.set(
    state.currentQuestion.id,
    dataUtils.updateFeatureProps(state.currentQuestion, newProps)
  );

  cabService.saveAnswerHistory(
    state.userId,
    dataUtils.mapToArray(state.questionFeatures)
  );

  const reviewCutoff = questionUtils.getReviewCutoff();

  if (nextAskDate > reviewCutoff) {
    // This question is far enough in the future. Stop asking.
    state.sessionQueue.delete(state.currentQuestion.id);

    if (!state.sessionQueue.size) {
      populateQueueWithNewQuestions();

      if (state.isReviewingLots) {
        state.isReviewingLots = false;

        setTimeout(() => {
          window.alert(
            `You've finished your reviews! Queueing up 10 new questions.`
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
 * Prints stats to the console about questions that have been answered so far
 *
 * @param {boolean} [showAlert]
 * @return {void}
 */
export const generateAndPrintStats = showAlert => {
  const SCORE_BRACKETS = {
    WRONG: { name: 'Wrong', count: 0 },
    CLOSE: { name: 'Close', count: 0 },
    RIGHT: { name: 'Right', count: 0 },
  };

  let total = 0;
  const now = Date.now();

  state.questionFeatures.forEach(feature => {
    const { lastScore, lastAskDate } = feature.properties;

    // Questions that haven't been answered are ignored
    if (typeof lastScore === 'undefined') return;

    // Only include the last few days of answers
    // (at least for now, while I'm tweaking the algorithm)
    if (now - lastAskDate > dateTimeUtils.daysToMillis(2)) return;

    let scoreBracket;
    if (lastScore === 0) {
      scoreBracket = SCORE_BRACKETS.WRONG;
    } else if (lastScore < 0.8) {
      scoreBracket = SCORE_BRACKETS.CLOSE;
    } else {
      scoreBracket = SCORE_BRACKETS.RIGHT;
    }

    total++;
    scoreBracket.count++;
  });

  if (!total) return;

  const finalMessage = [];

  Object.values(SCORE_BRACKETS).forEach(scoreBracket => {
    const percent = Math.round((scoreBracket.count / total) * 100);

    const message = `${scoreBracket.name}: ${percent}% (${scoreBracket.count})`;
    console.info(message);
    finalMessage.push(message);
  });

  if (showAlert) window.alert(finalMessage.join('\n'));
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

window.printStats = () => generateAndPrintStats();
window.questionManagerState = state;
