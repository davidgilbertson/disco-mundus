import assert from 'assert';
import {getNextAskDate} from './questions.mjs';
import {getIntervalAsWords} from './utils/utils.mjs';
import * as time from './utils/time.mjs';
import distance from './utils/distance.mjs';

const test = (name, func) => {
  try {
    func();
  } catch (err) {
    console.error(name, err);
  }
};

const now = 1000;
global.Date.now = () => now;
global.window = {};

test('Should convert intervals to human words', () => {
  [
    {millis: 0, result: '1 minute'},
    {millis: 1000 * 60, result: '1 minute'},
    {millis: 1000 * 60 * 3, result: '3 minutes'},
    {millis: 1000 * 60 * 59, result: '1 hour'},
    {millis: 1000 * 60 * 60 * 7, result: '7 hours'},
    {millis: 1000 * 60 * 60 * 23, result: '1 day'},
    {millis: 1000 * 60 * 60 * 24 * 2, result: '2 days'},
    {millis: 1000 * 60 * 60 * 24 * 8, result: 'a week'},
    {millis: 1000 * 60 * 60 * 24 * 14, result: '2 weeks'},
    {millis: 1000 * 60 * 60 * 24 * 31 * 3, result: '3 months'},
    {millis: 1000 * 60 * 60 * 24 * 31 * 12, result: '1 year'},
    {millis: 1000 * 60 * 60 * 24 * 365 * 1000, result: '1000 years'},
  ].forEach(test => {
    assert.strictEqual(getIntervalAsWords(test.millis), test.result);
  });

});

test('Should handle a new question answered right', () => {
  const nextAskDate = getNextAskDate({
    now,
    score: 1,
  });

  // Should be now + 10 minutes
  assert.strictEqual(nextAskDate, now + 10 * 60 * 1000);
});

test('Should handle a new question answered wrong', () => {
  const nextAskDate = getNextAskDate({
    now,
    score: 0,
  });

  // Should be now + 1 minute
  assert.strictEqual(nextAskDate, now + 60 * 1000);
});

test('Should handle a repeat question answered correctly', () => {
  const nextAskDate = getNextAskDate({
    now,
    score: 1,
    lastAskDate: now - time.daysToMillis(2),
  });

  // Should be now + 4 days
  assert.strictEqual(nextAskDate, now + time.daysToMillis(4));
});

test('Should handle a repeat question answered close but wrong', () => {
  const nextAskDate = getNextAskDate({
    now,
    score: 0.5,
    lastAskDate: now - time.daysToMillis(2),
  });

  // Should be now + 2 days again
  assert.strictEqual(nextAskDate, now + time.daysToMillis(2));
});

test('Should handle a repeat question answered wrong', () => {
  const nextAskDate = getNextAskDate({
    now,
    score: 0,
    lastAskDate: now - time.daysToMillis(2),
  });

  // Should be now + 0.4 days
  assert.strictEqual(nextAskDate, now + time.daysToMillis(0.4));
});

test('distance() should be close enough', () => {
  const rhodes = [151.08771136498115, -33.8292370857849];
  const wentworthPoint = [151.0771673576539, -33.827645764914124];
  assert.equal(
    Math.round(distance(wentworthPoint, rhodes)),
    1185 // about 1 KM, seems right, right?
  );

  const berowra =[151.13563025450014, -33.60389502541771];
  const cornulla = [151.15173920546326, -34.05850561581029];
  assert.equal(
    Math.round(distance(berowra, cornulla)),
    50544 // fiddy k's
  );
});

// test('sortFeaturesByAskDate() should sort good', () => {
//   // Note that 'now' is set to 1000 at the top of this file
//   const featuresWithDates = [
//     null,
//     300,
//     100,
//     null,
//     4000,
//     3000,
//     200,
//     1000,
//     null,
//     2000,
//     400,
//   ].map(nextAskDate => ({
//     properties: {nextAskDate}
//   }));
//
//   const sorted = sortFeaturesByAskDate(featuresWithDates);
//   const sortedDates = sorted.map(item => item.properties.nextAskDate);
//
//   assert.deepStrictEqual(sortedDates, [
//     100,
//     200,
//     300,
//     400,
//     null,
//     null,
//     null,
//     1000,
//     2000,
//     3000,
//     4000,
//   ])
// });
