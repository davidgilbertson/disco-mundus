/**
 * @typedef {Array<number>} Coords - [lng, lat]
 */

/**
 * @param {QuestionFeature} polygon
 * @return {Coords|undefined} coordinates
 */
export const getTopPoint = polygon => {
  if (!polygon || polygon.geometry.coordinates[0][0].length !== 2) return undefined;
  let topPoint = undefined;

  polygon.geometry.coordinates.flat().forEach(coord => {
    if (coord.length !== 2) {
      console.warn('Expected a two-number array. Got:', coord);
      return undefined;
    }

    if (!topPoint || coord[1] > topPoint[1]) {
      topPoint = coord;
    }
  });

  return topPoint;
};

/**
 * Checks if two polygons share a point, i.e. are therefore neighbors.
 *
 * @param {QuestionFeature} polygon1
 * @param {QuestionFeature} polygon2
 * @returns {boolean}
 */
export const areNeighbors = (polygon1, polygon2) => {
  const coords1Arr = polygon1.geometry.coordinates.flat().map(item => `${item[0]}-${item[1]}`);
  const coords2Arr = polygon2.geometry.coordinates.flat().map(item => `${item[0]}-${item[1]}`);

  const coords2Set = new Set(coords2Arr);

  return coords1Arr.some(coord1AsString => coords2Set.has(coord1AsString));
};
