import distance from './utils/distance.mjs';
import * as time from './utils/time.mjs';
import * as storage from './utils/storage.mjs';
import * as utils from './utils/utils.mjs';
import * as geo from './utils/geo.mjs';
import {STORAGE_KEYS, DMSR} from './utils/constants.mjs';
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
 * @property {string} properties.name
 * @property {Coords} properties.center
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
 * Details in the README.md
 *
 * @param {object} props
 * @param {DateTimeMillis} props.now
 * @param {number} props.score - between 0 and 1
 * @param {DateTimeMillis} [props.lastAskDate]
 * @return {DateTimeMillis} the next date/time, in milliseconds at which the question should be asked
 */
export const getNextAskDate = ({score, now, lastAskDate}) => {
  if (score < 0 || score > 1 || typeof score === 'undefined') throw Error('Score must be between 0 and 1');

  const lastInterval = lastAskDate
    ? now - lastAskDate
    : time.minsToMillis(DMSR.FIRST_TIME_MINS); // For new questions

  // We stretch the score (0 to 1) to fit the multiplier bounds ...
  const multiplier = score * (DMSR.MULTIPLIERS.MAX - DMSR.MULTIPLIERS.MIN) + DMSR.MULTIPLIERS.MIN;

  // ... and multiply the last interval by it (never less than 1 minute)
  const nextInterval = Math.max(time.minsToMillis(DMSR.MIN_MINS), lastInterval * multiplier);

  return Math.round(now + nextInterval);
};

/**
 * Converts the relative location of two polygons to a score
 *
 * @param {object} props
 * @param {Coords} props.clickCoords
 * @param {QuestionFeature} correctQuestionFeature
 * @param {QuestionFeature} clickedQuestionFeature
 * @return {number} a score between 0 and 1;
 */
export const distanceToScore = ({
  clickCoords,
  correctQuestionFeature,
  clickedQuestionFeature,
}) => {
  // Note, it would be nice to test if two features share a point, but features can be thousands
  // of points, so millions of combinations.
  if (geo.areNeighbors(correctQuestionFeature, clickedQuestionFeature)) {
    return DMSR.SCORE_FOR_NEIGHBOR;
  }

  const answerDistanceKms = distance(correctQuestionFeature.properties.center, clickCoords);

  return (DMSR.CLOSE_M - Math.min(answerDistanceKms, DMSR.CLOSE_M)) / DMSR.CLOSE_M;
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
 * @param {QuestionFeature} props.clickedFeature
 * @param {Coords} props.clickCoords
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
    score = distanceToScore({
      clickCoords,
      correctQuestionFeature: currentQuestion,
      clickedQuestionFeature: clickedFeature,
    });
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
