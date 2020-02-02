/* eslint-disable import/no-extraneous-dependencies, no-param-reassign */
const fs = require('fs').promises;
const simplify = require('@turf/simplify');
const area = require('@turf/area');
const center = require('@turf/center');

(async () => {
  console.time('Converted data in');
  const suburbData = await fs.readFile('./sydneySuburbsOriginal.json', 'utf8');
  const suburbFeatureCollection = JSON.parse(suburbData);

  suburbFeatureCollection.features = suburbFeatureCollection.features.map(
    feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        area: area(feature),
        center: center(feature).geometry.coordinates,
      },
    })
  );

  // Sort by area, smallest on top
  suburbFeatureCollection.features.sort(
    (a, b) => b.properties.area - a.properties.area
  );

  // Delete the area prop
  suburbFeatureCollection.features.forEach(feature => {
    delete feature.properties.area;
  });

  simplify(suburbFeatureCollection, {
    tolerance: 0.00001,
    highQuality: true,
    mutate: true,
  });

  await fs.writeFile(
    './sydneySuburbs.json',
    JSON.stringify(suburbFeatureCollection, null, 2)
  );

  console.timeEnd('Converted data in');
})();
