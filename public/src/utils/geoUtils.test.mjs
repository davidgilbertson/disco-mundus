import assert from 'assert';
import * as geoUtils from './geoUtils.mjs';

const now = 1000;
global.Date.now = () => now;
global.window = {};

test('distanceBetween() should be close enough', () => {
  const rhodes = [151.08771136498115, -33.8292370857849];
  const wentworthPoint = [151.0771673576539, -33.827645764914124];
  assert.equal(
    Math.round(geoUtils.distanceBetween(wentworthPoint, rhodes)),
    1185 // about 1 KM, seems right, right?
  );

  const berowra =[151.13563025450014, -33.60389502541771];
  const cornulla = [151.15173920546326, -34.05850561581029];
  assert.equal(
    Math.round(geoUtils.distanceBetween(berowra, cornulla)),
    50544 // fiddy k's
  );
});
