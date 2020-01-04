import distance from './utils/distance.mjs';
import * as time from './utils/time.mjs';
import * as storage from './utils/storage.mjs';
import * as utils from './utils/utils.mjs';
import {STORAGE_KEYS} from './utils/constants.mjs';
import cab from './cab.mjs';

/**
 * @typedef AnswerHistoryItem
 * @property {number} id - the feature ID
 * @property {number} nextAskDate - date/time in milliseconds. Used to select the next question
 * @property {number} lastAskDate - date/time in milliseconds.
 *    Used to calculate the nextAskDate once a question is answered
 */

/**
 * @typedef {number} DateTimeMillis - the date/time in milliseconds since the epoch
 */

/**
 * It seems that extending Feature doesn't allow overwriting the properties object, so this
 * creates a new definition and sets id/geometry manually
 *
 * @typedef QuestionFeature
 * @property {number} id
 * @property {object} properties
 * @property {DateTimeMillis} [properties.nextAskDate] - date/time in milliseconds.
 * @property {DateTimeMillis} [properties.lastAskDate] - date/time in milliseconds.
 * @property {number} [properties.lastScore] - the score, between 0 and 1
 * @property {Feature.geometry} geometry
 */

/** @type {string} */
let userId;

/**
 * @type {Array<QuestionFeature>}
 */
let allQuestionFeatures;

/**
 * @type {QuestionFeature}
 */
let currentQuestion;

/**
 * @type {Map<number, AnswerHistoryItem>}
 */
let answerHistoryMap;

/**
 * Returns the next date/time at which a question should be asked, based
 * on the last time it was asked and the score it was given this time.
 *
 * Note that SM-2 uses a multiplier between 1.3 and 2.5 ('easiness factor') that is unique to each question
 * and adjusted with each answer. This is based on the idea that
 * some things are inherently more difficult to commit to memory.
 * It also resets a question back to the start with a wrong answer.
 *
 * I'm just using a multiplier of between 0.1 and 2, based on the answer score.
 * E.g. if it's been 10 days since you last answered the question (meaning you got it right several times in a row), then if:
 *  - you get it wrong (score 0): it will ask you in 1 day
 *  - you get it close (score 0.5): it will ask you in another 10
 *  - you get it right (score 1): it will ask you again in 20 days
 *
 * @param {object} props
 * @param {number} props.now
 * @param {number} props.score - between 0 and 1
 * @param {DateTimeMillis} [props.lastAskDate]
 * @return {DateTimeMillis} the next date/time, in milliseconds at which the question should be asked
 */
export const getNextAskDate = ({score, now, lastAskDate}) => {
  const lastInterval = lastAskDate
    ? now - lastAskDate
    : time.minsToMillis(10); // For new questions, 10 minutes

  // We convert the score (0 to 1) to a multiplier (0.1 to 2)
  const multiplier = Math.max(score, 0.05) * 2;

  // And multiply the last interval by it. But never less than 1 minute
  const nextInterval = Math.max(time.minsToMillis(1), lastInterval * multiplier);

  return Math.round(now + nextInterval);
};

/**
 * Converts the distance between two points to a score
 * @param {Array<number>} coords1 - [lng, lat]
 * @param {Array<number>} coords2 - [lng, lat]
 * @return {number} score - a score between 0 and 1;
 */
export const distanceToScore = (coords1, coords2) => {
  // You get some points for being close
  const CLOSE = 10000; // 10 KMs
  const answerDistanceKms = distance(coords1, coords2);

  // 1 when distance is 0
  // 0 when distance is 10km or more
  return (CLOSE - Math.min(answerDistanceKms, CLOSE)) / CLOSE;
};

const updateAnswerHistory = score => {
  const now = Date.now();

  const nextAskDate = getNextAskDate({
    lastAskDate: currentQuestion.properties.lastAskDate,
    score,
    now,
  });

  const newProps = {
    lastAskDate: now,
    lastScore: score,
    nextAskDate,
  };

  // Update the item in the array of features in memory
  allQuestionFeatures = allQuestionFeatures.map(feature => {
    if (feature.id !== currentQuestion.id) return feature;

    return utils.updateFeatureProps(feature, newProps);
  });

  // Update the history data to save to the database
  answerHistoryMap.set(currentQuestion.id, Object.assign({},
    {id: currentQuestion.id},
    newProps
  ));

  // For now, while testing, I'll keep saving to LS.
  // But if anything comes back from the server on page load, LS is ignored.
  storage.set(STORAGE_KEYS.ANSWER_HISTORY, utils.mapToArray(answerHistoryMap));

  // This setup kinda-sorta handles temporarily going offline.
  // If you answer two questions in a tunnel with no reception, then a third when back online, everything is saved
  cab.update(userId, {answerHistory: utils.mapToArray(answerHistoryMap)})
    .then(response => {
      if (response.error) {
        console.error('Could not save progress:', response.error);
      }
    });

  return nextAskDate;
};

/**
 * @return {QuestionFeature}
 */
export const getCurrentQuestion = () => currentQuestion;

/**
 * Prints stats to the console about questions that have been answered so far
 *
 * @param {boolean} [showAlert]
 */
export const generateAndPrintStats = showAlert => {
  const SCORE_BRACKETS = {
    WRONG: {name: 'Wrong', count: 0},
    CLOSE: {name: 'Close', count: 0},
    RIGHT: {name: 'Right', count: 0},
  };

  let total = 0;

  allQuestionFeatures.forEach(feature => {
    const {lastScore} = feature.properties;

    // Questions that haven't been answered are ignored
    if (typeof lastScore === 'undefined') return;

    const scoreBracket = lastScore === 0
      ? SCORE_BRACKETS.WRONG
      : lastScore < 0.8
        ? SCORE_BRACKETS.CLOSE
        : SCORE_BRACKETS.RIGHT;

    total++;
    scoreBracket.count++;
  });

  if (!total) return;

  const finalMessage = [];

  Object.values(SCORE_BRACKETS).forEach(scoreBracket => {
    const percent = Math.round(scoreBracket.count / total * 100);

    const message = `${scoreBracket.name}: ${scoreBracket.count} (${percent}%)`;
    console.log(message);
    finalMessage.push(message);
  });

  if (showAlert) window.alert(finalMessage.join('\n'));
};

window.printStats = () => generateAndPrintStats();

export const getPageStats = () => {
  let today = 0;
  let unseen = 0;
  let future = 0;
  const now = Date.now();

  allQuestionFeatures.forEach(feature => {
    if (!feature.properties.nextAskDate) {
      unseen++;
    } else if (feature.properties.nextAskDate < now) {
      today++;
    } else {
      future++
    }
  });

  return {today, unseen, future};
};

/**
 * Returns the next question due to be reviewed, or if there are none, a not-seen-yet question
 * The list could be slightly different each time, so we loop through every time we want a new question
 *
 * @return {QuestionFeature} - the next appropriate question
 */
export const getNextQuestion = () => {
  // TODO (davidg): unit tests..
  let nextReviewQuestion;
  const unseenQuestions = [];

  allQuestionFeatures.forEach(question => {
    if (!question.properties.nextAskDate) {
      unseenQuestions.push(question);
      return;
    }

    if (!nextReviewQuestion || question.properties.nextAskDate < nextReviewQuestion.properties.nextAskDate) {
      nextReviewQuestion = question;
    }
  });

  if (nextReviewQuestion && nextReviewQuestion.properties.nextAskDate < Date.now()) {
    currentQuestion = nextReviewQuestion;
  } else {
    currentQuestion = unseenQuestions[0];
  }

  return currentQuestion;
};

/**
 * @param {object} [props]
 * @param props.clickedFeature
 * @param props.clickCoords
 * @return {{score: number, nextAskDate: number}}
 */
export const answerQuestion = ({clickedFeature, clickCoords} = {}) => {
  let score; // from 0 to 1

  if (!clickedFeature) {
    // No answer attempted
    score = 0;
  } else if (clickedFeature.properties.name === currentQuestion.properties.name) {
    // Answer is exactly correct
    score = 1;
  } else {
    // Base the score on how close the guess was
    score = distanceToScore(clickCoords, currentQuestion.properties.center);
  }

  const nextAskDate = updateAnswerHistory(score);

  return {score, nextAskDate};
};

/**
 * Mixes in answer history and sorts the features by nextAskDate.
 * Doesn't return. Features can be accessed with getNextQuestion()
 *
 * @param {object} props
 * @param {string} props.id
 * @param {{features: Array<QuestionFeature>}} props.questionFeatureCollection
 * @param {Array<AnswerHistoryItem>} props.answerHistory
 */
export const init = ({id, questionFeatureCollection, answerHistory}) => {
  userId = id;

  // For now, check to see if there was any history stored in LS. This can be removed eventually so I'll no
  // longer store progress in LS.
  if (!answerHistory.length) {
    const localAnswerHistory = storage.get(STORAGE_KEYS.ANSWER_HISTORY);
    answerHistoryMap = utils.arrayToMap(localAnswerHistory || []);

    if (localAnswerHistory && localAnswerHistory.length) {
      // Take it out of LS And save it to the server
      cab.update(userId, {answerHistory: utils.mapToArray(answerHistoryMap)})
        .then(response => {
          if (response.error) {
            console.error('Could not save progress:', response.error);
          }
        });
    }
  } else {
    answerHistoryMap = utils.arrayToMap(answerHistory);
  }

  allQuestionFeatures = questionFeatureCollection.features.map(feature => {
    const matchingHistoryItem = answerHistoryMap.get(feature.id) || {};

    return utils.updateFeatureProps(feature, {
      nextAskDate: matchingHistoryItem.nextAskDate,
      lastAskDate: matchingHistoryItem.lastAskDate,
      lastScore: matchingHistoryItem.lastScore,
    });
  });
};
