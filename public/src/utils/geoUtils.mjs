/**
 * @typedef {Array<number>} Coords - [lng, lat]
 */

/**
 * @param {QuestionFeature} polygon
 * @return {Coords|undefined} coordinates
 */
export const getTopPoint = polygon => {
  if (!polygon || polygon.geometry.coordinates[0][0].length !== 2) {
    return undefined;
  }

  let topPoint;

  polygon.geometry.coordinates.flat().forEach(coord => {
    if (coord.length !== 2) {
      console.warn('Expected a two-number array. Got:', coord);
    } else if (!topPoint || coord[1] > topPoint[1]) {
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
 * @return {boolean}
 */
export const areNeighbors = (polygon1, polygon2) => {
  const coords1Arr = polygon1.geometry.coordinates
    .flat()
    .map(item => `${item[0]}-${item[1]}`);

  const coords2Arr = polygon2.geometry.coordinates
    .flat()
    .map(item => `${item[0]}-${item[1]}`);

  const coords2Set = new Set(coords2Arr);

  return coords1Arr.some(coord1AsString => coords2Set.has(coord1AsString));
};

/**
 * @param {Coords} point1
 * @param {Coords} point2
 * @return {number} - the distance, in meters, roughly.
 */
export const distanceBetween = (point1, point2) => {
  const CIRCUMFERENCE = 40000000;

  const lngDiff = Math.abs(point2[0] - point1[0]);
  const latDiff = Math.abs(point2[1] - point1[1]);

  const latDiffMeters = (latDiff / 360) * CIRCUMFERENCE;
  const lngDiffMeters = (lngDiff / 360) * CIRCUMFERENCE;

  return Math.sqrt(latDiffMeters ** 2 + lngDiffMeters ** 2);
};

/**
 * Get the appropriate zoom level to fit a certain number of kms on a
 * certain sized screen. Like 'zoom to fit' but can be used for the initial
 * rendering of the map.
 *
 * @param {object} props
 * @param {number} props.kms - e.g. 70 to fit Sydney which is 70km wide
 * @param {number} [props.pixels] - e.g. the device width
 * @param {number} [props.lat] - the latitude
 * @return {number}
 */
export const getZoomToFit = ({ kms, pixels = window.innerWidth, lat = 0 }) => {
  // This is based on what I could find here:
  // https://docs.mapbox.com/help/glossary/zoom-level

  // Work out the kms/pixel for the given latitude
  const kpp = 78.271484 * Math.cos(Math.PI * (lat / 180));

  // Work out the correct zoom to fit the given kms
  return Math.log2(kpp / (kms / pixels));
};
