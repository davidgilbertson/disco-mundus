import assert from 'assert';
import {getNextAskDate} from './questions.mjs';
import {daysToMillis} from './timeUtils.mjs';
import distance from './distance.mjs';

const test = (name, func) => {
  try {
    func();
  } catch (err) {
    console.error(name, err);
  }
};

const now = 7777777777;
global.Date.now = () => now;

test('Should handle a new question answered right', () => {
  const nextAskDate = getNextAskDate({
    question: {},
    score: 1,
  });

  // Should be now + 10 minutes
  assert.strictEqual(nextAskDate, now + 10 * 60 * 1000);
});

test('Should handle a new question answered wrong', () => {
  const nextAskDate = getNextAskDate({
    question: {},
    score: 0,
  });

  // Should be now + 1 minute
  assert.strictEqual(nextAskDate, now + 60 * 1000);
});

test('Should handle a repeat question answered correctly', () => {
  const nextAskDate = getNextAskDate({
    question: {
      nextAskDate: now - daysToMillis(2),
    },
    score: 1,
  });

  // Should be now + 4 days
  assert.strictEqual(nextAskDate, now + daysToMillis(4));
});

test('Should handle a repeat question answered close but wrong', () => {
  const nextAskDate = getNextAskDate({
    question: {
      nextAskDate: now - daysToMillis(2),
    },
    score: 0.5,
  });

  // Should be now + 2 days again
  assert.strictEqual(nextAskDate, now + daysToMillis(2));
});

test('Should handle a repeat question answered wrong', () => {
  const nextAskDate = getNextAskDate({
    question: {
      nextAskDate: now - daysToMillis(2),
    },
    score: 0,
  });

  // Should be now + 0.4 days
  assert.strictEqual(nextAskDate, now + daysToMillis(0.4));
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
