import {minsToMillis} from './timeUtils.mjs';
import distance from './distance.mjs';

/**
 * Returns the next date/time at which a question should be asked, based
 * on the last time it was asked and the score it was given this time
 * @param {object} props
 * @param {object} props.question
 * @param {number} props.score - between 0 and 1
 *
 * @return {number} the next date/time at which the question should be asked
 */

export const getNextAskDate = ({question, score}) => {
  // We put the score in a range 0.1 to 1 to use as a multiplier
  const multiplier = Math.max(score, 0.1);
  const now = Date.now();

  const lastInterval = question.nextAskDate
    ? now - question.nextAskDate
    : minsToMillis(5); // For new questions, 5 minutes

  return Math.round(now + (lastInterval * 2 * multiplier));
};

/**
 * Converts the distance between two points to a score
 * @param {object} lngLat1
 * @param {object} lngLat2
 * @return {number} score - a score between 0 and 1;
 */
export const distanceToScore = (lngLat1, lngLat2) => {
  // You get some points for being close
  const CLOSE = 10000; // 10 KMs
  const answerDistanceKms = distance(
    [lngLat1.lng, lngLat1.lat],
    [lngLat2.lng, lngLat2.lat]
  );

  // 1 when distance is 0
  // 0 when distance is 10km or more
  return (CLOSE - Math.min(answerDistanceKms, CLOSE)) / CLOSE;
};
