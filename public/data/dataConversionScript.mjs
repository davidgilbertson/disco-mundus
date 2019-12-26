import fs from 'fs';

const suburbData = fs.readFileSync('./questionFeatureCollection.json', 'utf8');
const suburbFeatureCollection = JSON.parse(suburbData);

suburbFeatureCollection.features = suburbFeatureCollection.features.map(suburb => ({
  ...suburb,
  properties: {
    ...suburb.properties,
    center: [suburb.properties.center.lng, suburb.properties.center.lat],
  },
}));

fs.writeFileSync(
  './questionFeatureCollection.json',
  JSON.stringify(suburbFeatureCollection, null, 2)
);
