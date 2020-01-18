import { promises as fs } from 'fs';

import simplifyModule from '@turf/simplify'; // a commonJS module
const simplify = simplifyModule.default;

import areaModule from '@turf/area'; // a commonJS module
const area = areaModule.default;

import centerModule from '@turf/center'; // a commonJS module
const center = centerModule.default;

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
  suburbFeatureCollection.features.map(feature => {
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
