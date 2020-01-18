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
