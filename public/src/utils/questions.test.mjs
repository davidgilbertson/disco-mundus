import assert from 'assert';
import * as questionUtils from './questionUtils.mjs';
import * as dateTimeUtils from './dateTimeUtils.mjs';

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
    {millis: 1000 * 60 * 60 * 24 * 15, result: 'a week and a bit'},
    {millis: 1000 * 60 * 60 * 24 * 21, result: '3 weeks'},
    {millis: 1000 * 60 * 60 * 24 * 31 * 3, result: '3 months'},
    {millis: 1000 * 60 * 60 * 24 * 31 * 12, result: 'a year'},
    {millis: 1000 * 60 * 60 * 24 * 365 * 1000, result: '1000 years'},
  ].forEach(test => {
    assert.strictEqual(questionUtils.getIntervalAsWords(test.millis), test.result);
  });

});

test('Should handle a new question answered right', () => {
  const nextAskDate = questionUtils.getNextAskDate({
    now,
    score: 1,
  });

  // Should be now + 20 minutes
  assert.strictEqual(nextAskDate, now + 20 * 60 * 1000);
});

test('Should handle a new question answered wrong', () => {
  const nextAskDate = questionUtils.getNextAskDate({
    now,
    score: 0,
  });

  // Should be now + 1 minute
  assert.strictEqual(nextAskDate, now + 60 * 1000);
});

test('Should handle a repeat question answered correctly', () => {
  const nextAskDate = questionUtils.getNextAskDate({
    now,
    score: 1,
    lastAskDate: now - dateTimeUtils.daysToMillis(2),
  });

  // Should be now + 4 days
  assert.strictEqual(nextAskDate, now + dateTimeUtils.daysToMillis(4));
});

test('Should handle a repeat question answered close but wrong', () => {
  const nextAskDate = questionUtils.getNextAskDate({
    now,
    score: 0.5,
    lastAskDate: now - dateTimeUtils.daysToMillis(2),
  });

  // Should be now + 2 days again
  assert.strictEqual(nextAskDate, now + dateTimeUtils.daysToMillis(2));
});

test('Should handle a repeat question answered wrong', () => {
  const nextAskDate = questionUtils.getNextAskDate({
    now,
    score: 0,
    lastAskDate: now - dateTimeUtils.daysToMillis(2),
  });

  // Should be now + 0.2 days
  assert.strictEqual(nextAskDate, now + dateTimeUtils.daysToMillis(0.2));
});
