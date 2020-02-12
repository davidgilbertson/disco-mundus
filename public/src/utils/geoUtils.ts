export const getTopPoint = (
  polygon: QuestionFeature
): LngLatArray | undefined => {
  if (polygon.geometry.coordinates[0][0].length !== 2) {
    return undefined;
  }

  const points: LngLatArray[] = polygon.geometry.coordinates.flat();

  if (!points.length) return;

  let topPoint = points[0];

  points.forEach((coord) => {
    if (Array.isArray(coord) && coord.length === 2 && coord[1] > topPoint[1]) {
      topPoint = coord;
    }
  });

  return topPoint;
};

/**
 * Checks if two polygons share a point, i.e. are therefore neighbors.
 */
export const areNeighbors = (
  polygon1: QuestionFeature,
  polygon2: QuestionFeature
): boolean => {
  const coords1Arr = polygon1.geometry.coordinates
    .flat()
    .map((item) => `${item[0]}-${item[1]}`);

  const coords2Arr = polygon2.geometry.coordinates
    .flat()
    .map((item) => `${item[0]}-${item[1]}`);

  const coords2Set = new Set(coords2Arr);

  return coords1Arr.some((coord1AsString) => coords2Set.has(coord1AsString));
};

export const distanceBetween = (
  point1: LngLatArray,
  point2: LngLatArray
): number => {
  const CIRCUMFERENCE = 40000000;

  const lngDiff = Math.abs(point2[0] - point1[0]);
  const latDiff = Math.abs(point2[1] - point1[1]);

  const latDiffMeters = (latDiff / 360) * CIRCUMFERENCE;
  const lngDiffMeters = (lngDiff / 360) * CIRCUMFERENCE;

  return Math.sqrt(latDiffMeters ** 2 + lngDiffMeters ** 2);
};

type GetZoomToFitProps = {
  kms: number;
  pixels?: number;
  lat?: number;
};

/**
 * Get the appropriate zoom level to fit a certain number of kms on a
 * certain sized screen. Like 'zoom to fit' but can be used for the initial
 * rendering of the map.
 */
export const getZoomToFit = ({
  kms,
  pixels = window.innerWidth,
  lat = 0,
}: GetZoomToFitProps): number => {
  // This is based on what I could find here:
  // https://docs.mapbox.com/help/glossary/zoom-level

  // Work out the kms/pixel for the given latitude
  const kpp = 78.271484 * Math.cos(Math.PI * (lat / 180));

  // Work out the correct zoom to fit the given kms
  return Math.log2(kpp / (kms / pixels));
};
