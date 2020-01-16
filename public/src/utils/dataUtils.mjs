export const arrayToMap = arr => new Map(arr.map(item => [item.id, item]));

export const mapToArray = map => Array.from(map.values());

/**
 * @param {QuestionFeature} feature
 * @param {object} props
 * @return {QuestionFeature}
 */
export const updateFeatureProps = (feature, props) =>
  Object.assign({}, feature, {
    properties: Object.assign({}, feature.properties, props),
  });

export const getAppInfo = async () => {
  const estimate = await navigator.storage.estimate();
  const usage = Math.round(estimate.usage / 1000000);
  const quota = Math.round(estimate.quota / 1000000);

  return [
    'Version: 1',
    '----------',
    `Storage used: ${usage.toLocaleString()} MB of ${quota.toLocaleString()} MB`,
  ].join('\n');
};
