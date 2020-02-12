/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs').promises;
const turf = require('@turf/turf');

(async () => {
  console.time('Converted data in');
  const dataString = await fs.readFile('./sydneySuburbsOriginal.json', 'utf8');
  const featureCollection = JSON.parse(dataString);

  featureCollection.features = featureCollection.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      area: turf.area(feature),
      center: turf.center(feature).geometry.coordinates,
    },
  }));

  // Sort by area, smallest on top
  featureCollection.features.sort(
    (a, b) => b.properties.area - a.properties.area
  );

  // Delete the area prop
  featureCollection.features.forEach((feature) => {
    delete feature.properties.area;
  });

  turf.simplify(featureCollection, {
    tolerance: 0.00001,
    highQuality: true,
    mutate: true,
  });

  await fs.writeFile(
    './sydneySuburbs.json',
    JSON.stringify(featureCollection, null, 2)
  );

  console.timeEnd('Converted data in');
})();
