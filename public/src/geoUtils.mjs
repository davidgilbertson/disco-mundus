/**
 *
 * @param {Feature} polygon
 * @return {Array<number>} coordinates
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
