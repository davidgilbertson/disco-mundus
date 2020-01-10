import {promises as fs} from 'fs';

(async () => {
  const suburbData = await fs.readFile('./sydneySuburbs.json', 'utf8');
  const suburbFeatureCollection = JSON.parse(suburbData);

  suburbFeatureCollection.features = suburbFeatureCollection.features.map(suburb => ({
    ...suburb,
    properties: {
      ...suburb.properties,
      center: [suburb.properties.center.lng, suburb.properties.center.lat],
    },
  }));

  await fs.writeFile(
    './sydneySuburbs.json',
    JSON.stringify(suburbFeatureCollection, null, 2)
  );
})();
