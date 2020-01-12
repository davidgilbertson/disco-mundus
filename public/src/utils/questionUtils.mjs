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
 * @param {QuestionFeature} props.question
 * @param {number} props.score - between 0 and 1
 * @return {DateTimeMillis} nextAskDate - when the question should next be asked
 */
export const getNextAskDate = ({ question, score }) => {
  if (score < 0 || score > 1 || typeof score === 'undefined') {
    throw Error('Score must be between 0 and 1');
  }
  const { lastAskDate, nextAskDate } = question.properties;

  // If we review a question a few minutes early, we want to calculate the
  // next review time based on when it was supposed to be asked.
  const ostensibleAnswerDate = Math.max(Date.now(), nextAskDate || 0);

  const lastInterval = lastAskDate
    ? ostensibleAnswerDate - lastAskDate
    : dateTimeUtils.minsToMillis(DMSR.FIRST_TIME_MINS / DMSR.MULTIPLIER);

  const multiplier = score * DMSR.MULTIPLIER;

  // ... and multiply the last interval by it (never less than 1 minute)
  const nextInterval = Math.max(
    dateTimeUtils.minsToMillis(DMSR.MIN_MINS),
    lastInterval * multiplier
  );

  return Math.round(ostensibleAnswerDate + nextInterval);
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

export const getReviewCutoff = () =>
  Date.now() + dateTimeUtils.minsToMillis(DMSR.LOOKAHEAD_WINDOW_MINS);

/**
 * Converts a date/time into a readable string
 *
 * @param {DateTimeMillis} dateTime - a time, presumably in the future
 * @return {string}
 */
export const getDateTimeAsWords = dateTime => {
  if (dateTime < getReviewCutoff()) return 'soon';

  const millis = dateTime - Date.now();

  const minutes = Math.round(millis / 1000 / 60);
  if (minutes < 2) return 'in 1 minute';
  if (minutes < 50) return `in ${minutes} minutes`;

  const hours = Math.round(minutes / 60);
  if (hours < 2) return 'in 1 hour';
  if (hours < 20) return `in ${hours} hours`;

  const days = Math.round(hours / 24);
  if (days < 2) return 'in 1 day';
  if (days < 6) return `in ${days} days`;

  const weeks = Math.round(days / 7);
  if (weeks < 2) return 'in a week';
  if (weeks < 3) return 'in a week and a bit';
  if (weeks < 4) return `in ${weeks} weeks`;

  const months = Math.round(days / 30);
  if (months < 2) return 'in a month';
  if (months < 11) return `in ${months} months`;

  const years = Math.round(days / 365);
  if (years < 2) return 'in a year';

  return `in ${years} years`;
};
