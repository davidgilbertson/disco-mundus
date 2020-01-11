import * as cabService from './cabService.mjs';
import * as dataUtils from './utils/dataUtils.mjs';
import * as dateTimeUtils from './utils/dateTimeUtils.mjs';
import * as questionUtils from './utils/questionUtils.mjs';

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

  /** @type {Array<QuestionFeature>} */
  allQuestionFeatures: [],

  /** @type {?QuestionFeature} */
  currentQuestion: null,

  /** @type {Array<QuestionFeature>} */
  queue: [], // A set of questions to be completed before moving on
};

/**
 * @return {QuestionFeature}
 */
export const getCurrentQuestion = () => state.currentQuestion;

/**
 * Mixes in answer history and sorts the features by nextAskDate.
 * Doesn't return. Features can be accessed with getNextQuestion()
 *
 * @param {object} props
 * @param {string} props.userId
 * @param {{features: Array<QuestionFeature>}} props.questionFeatureCollection
 * @param {Array<AnswerHistoryItem>} props.answerHistory
 */
export const init = ({ userId, questionFeatureCollection, answerHistory }) => {
  state.userId = userId;

  const answerHistoryMap = dataUtils.arrayToMap(answerHistory);

  state.allQuestionFeatures = questionFeatureCollection.features.map(
    feature => {
      const matchingHistoryItem = answerHistoryMap.get(feature.id) || {};

      return dataUtils.updateFeatureProps(feature, {
        nextAskDate: matchingHistoryItem.nextAskDate,
        lastAskDate: matchingHistoryItem.lastAskDate,
        lastScore: matchingHistoryItem.lastScore,
      });
    }
  );

  // Now, we populate the queue.
  // - If there's questions to review, they're the queue
  // - Else take 10 new ones
};

const updateAnswerHistory = score => {
  const now = Date.now();

  const nextAskDate = questionUtils.getNextAskDate({
    lastAskDate: state.currentQuestion.properties.lastAskDate,
    score,
    now,
  });

  const newProps = {
    lastAskDate: now,
    lastScore: score,
    nextAskDate,
  };

  // Update the item in the array of features in memory
  state.allQuestionFeatures = state.allQuestionFeatures.map(feature => {
    if (feature.id !== state.currentQuestion.id) return feature;

    return dataUtils.updateFeatureProps(feature, newProps);
  });

  cabService.saveAnswerHistory(state.userId, state.allQuestionFeatures);
  return nextAskDate;
};

/**
 * Returns the next question due to be reviewed,
 * or if there are none, a not-seen-yet question
 * The list could be slightly different each time,
 * so we loop through every time we want a new question
 *
 * @return {QuestionFeature} - the next appropriate question
 */
export const getNextQuestion = () => {
  let nextReviewQuestion;
  const unseenQuestions = [];

  state.allQuestionFeatures.forEach(question => {
    if (!question.properties.nextAskDate) {
      unseenQuestions.push(question);
      return;
    }

    if (
      !nextReviewQuestion ||
      question.properties.nextAskDate <
        nextReviewQuestion.properties.nextAskDate
    ) {
      nextReviewQuestion = question;
    }
  });

  if (
    nextReviewQuestion &&
    nextReviewQuestion.properties.nextAskDate < Date.now()
  ) {
    state.currentQuestion = nextReviewQuestion;
  } else {
    state.currentQuestion = unseenQuestions[0];
  }

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

  const nextAskDate = updateAnswerHistory(score);

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

  state.allQuestionFeatures.forEach(feature => {
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
 * @return {{future: number, today: number, unseen: number}}
 */
export const getPageStats = () => {
  let today = 0;
  let unseen = 0;
  let future = 0;
  const now = Date.now();

  state.allQuestionFeatures.forEach(feature => {
    if (!feature.properties.nextAskDate) {
      unseen++;
    } else if (feature.properties.nextAskDate < now) {
      today++;
    } else {
      future++;
    }
  });

  return { today, unseen, future };
};

window.printStats = () => generateAndPrintStats();
window.questionManagerState = state;
