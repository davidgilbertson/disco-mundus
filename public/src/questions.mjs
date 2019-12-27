import {minsToMillis} from './timeUtils.mjs';
import distance from './distance.mjs';
import * as storage from './storage.mjs';
import {STORAGE_KEYS} from './constants.mjs';
import * as utils from './utils.mjs';
import cab from './cab.mjs';

/**
 * @typedef AnswerHistoryItem
 * @property {number} id - the feature ID
 * @property {number} nextAskDate - date/time in milliseconds. Used to select the next question
 * @property {number} lastAskDate - date/time in milliseconds.
 *    Used to calculate the nextAskDate once a question is answered
 * @property {number} testing
 */

let progressId;

/**
 * @type {Array<Feature>}
 */
let allQuestionFeatures;

/**
 * @type {Feature}
 */
let currentQuestion;

/**
 * @type {Map<string, AnswerHistoryItem>}
 */
let answerHistoryMap;

/**
 * Returns the next date/time at which a question should be asked, based
 * on the last time it was asked and the score it was given this time
 * @param {object} props
 * @param {number} props.now
 * @param {number} props.score - between 0 and 1
 * @param {number} [props.lastAskDate]
 *
 * @return {number} the next date/time at which the question should be asked
 */
export const getNextAskDate = ({score, now, lastAskDate}) => {
  // We put the score in a range 0.2 to 2 to use as a multiplier
  const multiplier = Math.max(score, 0.1) * 2;


  const lastInterval = lastAskDate
    ? now - lastAskDate
    : minsToMillis(10); // For new questions, 10 minutes

  // Never less than 2 minutes
  const nextInterval = Math.max(1000 * 60 * 2, lastInterval * multiplier);

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

  const dateProps = {
    lastAskDate: now,
    nextAskDate,
  };

  // Update the item in the array of features
  allQuestionFeatures = allQuestionFeatures.map(feature => {
    if (feature.id !== currentQuestion.id) return feature;

    return utils.updateFeatureProps(feature, dateProps);
  });

  // And the history data to save
  answerHistoryMap.set(currentQuestion.id, Object.assign({},
    {id: currentQuestion.id},
    dateProps
  ));

  // For now, while testing, I'll keep saving to LS.
  // But if anything comes back from the server on page load, LS is ignored.
  storage.set(STORAGE_KEYS.ANSWER_HISTORY, utils.mapToArray(answerHistoryMap));

  // This setup kinda-sorta handles temporarily going offline.
  // If you answer two questions in a tunnel with no reception, then a third when back online, everything is saved
  cab.update(progressId, {answerHistory: utils.mapToArray(answerHistoryMap)})
    .then(response => {
      if (response.error) {
        console.error('Could not save progress:', response.error);
      }
    });

  return nextAskDate;
};

export const getCurrentQuestion = () => currentQuestion;

export const getStats = () => {
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
 * @return {Feature} - the next appropriate question
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
 * @param {FeatureCollection} props.questionFeatureCollection
 * @param {Array<AnswerHistoryItem>} props.answerHistory
 * @param {string} props.id
 */
export const init = ({questionFeatureCollection, answerHistory, id}) => {
  progressId = id;

  // For now, check to see if there was any history stored in LS. This can be removed eventually so I'll no
  // longer store progress in LS.
  if (!answerHistory.length) {
    const localAnswerHistory = storage.get(STORAGE_KEYS.ANSWER_HISTORY);
    answerHistoryMap = utils.arrayToMap(localAnswerHistory || []);

    if (localAnswerHistory && localAnswerHistory.length) {
      // Take it out of LS And save it to the server
      cab.update(progressId, {answerHistory: utils.mapToArray(answerHistoryMap)})
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
      nextAskDate: matchingHistoryItem.nextAskDate, // maybe undefined
      lastAskDate: matchingHistoryItem.lastAskDate, // maybe undefined
    });
  });
};
