import * as dateTimeUtils from './dateTimeUtils.mjs';
import * as geoUtils from './geoUtils.mjs';
import { DMSR } from '../constants.mjs';

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
 * @return {DateTimeMillis} the next date/time, in
 *   milliseconds at which the question should be asked
 */
export const getNextAskDate = ({ score, now, lastAskDate }) => {
  if (score < 0 || score > 1 || typeof score === 'undefined') {
    throw Error('Score must be between 0 and 1');
  }

  const lastInterval = lastAskDate
    ? now - lastAskDate
    : dateTimeUtils.minsToMillis(DMSR.FIRST_TIME_MINS); // For new questions

  // We stretch the score (0 to 1) to fit the multiplier bounds ...
  const multiplier =
    score * (DMSR.MULTIPLIERS.MAX - DMSR.MULTIPLIERS.MIN) +
    DMSR.MULTIPLIERS.MIN;

  // ... and multiply the last interval by it (never less than 1 minute)
  const nextInterval = Math.max(
    dateTimeUtils.minsToMillis(DMSR.MIN_MINS),
    lastInterval * multiplier
  );

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
export const calculateAnswerScore = ({
  clickCoords,
  correctQuestionFeature,
  clickedQuestionFeature,
}) => {
  // Note, it would be nice to test if two features share a point,
  // but features can be thousands
  // of points, so millions of combinations.
  if (geoUtils.areNeighbors(correctQuestionFeature, clickedQuestionFeature)) {
    return DMSR.SCORE_FOR_NEIGHBOR;
  }

  const answerDistanceKms = geoUtils.distanceBetween(
    correctQuestionFeature.properties.center,
    clickCoords
  );

  return (
    (DMSR.CLOSE_M - Math.min(answerDistanceKms, DMSR.CLOSE_M)) / DMSR.CLOSE_M
  );
};

/**
 * Converts a duration into a readable string
 *
 * @param {number} millis - a period of time in milliseconds
 * @return {string}
 */
export const getIntervalAsWords = millis => {
  const minutes = Math.round(millis / 1000 / 60);
  if (minutes < 2) return '1 minute';
  if (minutes < 50) return `${minutes} minutes`;

  const hours = Math.round(minutes / 60);
  if (hours < 2) return '1 hour';
  if (hours < 20) return `${hours} hours`;

  const days = Math.round(hours / 24);
  if (days < 2) return '1 day';
  if (days < 6) return `${days} days`;

  const weeks = Math.round(days / 7);
  if (weeks < 2) return 'a week';
  if (weeks < 3) return 'a week and a bit';
  if (weeks < 4) return `${weeks} weeks`;

  const months = Math.round(days / 30);
  if (months < 2) return 'a month';
  if (months < 11) return `${months} months`;

  const years = Math.round(days / 365);
  if (years < 2) return 'a year';

  return `${years} years`;
};
