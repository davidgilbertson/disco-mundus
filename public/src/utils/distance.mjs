/**
 *
 * @param {Coords} point1
 * @param {Coords} point2
 * @return {number} - the distance, in meters, roughly.
 */
export default function (point1, point2) {
  const CIRCUMFERENCE = 40000000;

  const lngDiff = Math.abs(point2[0] - point1[0]);
  const latDiff = Math.abs(point2[1] - point1[1]);

  const latDiffMeters = (latDiff / 360) * CIRCUMFERENCE;
  const lngDiffMeters = (lngDiff / 360) * CIRCUMFERENCE;

  return Math.sqrt(latDiffMeters ** 2 + lngDiffMeters ** 2);
}
