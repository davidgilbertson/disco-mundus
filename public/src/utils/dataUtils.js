export const arrayToMap = arr => new Map(arr.map(item => [item.id, item]));

/**
 * @template T
 * @param {Array<T>} array
 * @param {T} newItem
 * @return {Array<T>|undefined}
 */
export const upsert = (array, newItem) => {
  if (!newItem.id) {
    console.error(`This item doesn't have an id:`, newItem);
    return undefined;
  }

  let itemExists = false;

  const nextArray = array.map(existingItem => {
    if (existingItem.id === newItem.id) {
      itemExists = true;
      return newItem;
    }

    return existingItem;
  });

  if (!itemExists) nextArray.push(newItem);

  return nextArray;
};

/**
 * @param {QuestionFeature} feature
 * @param {object} props
 * @return {QuestionFeature}
 */
export const updateFeatureProps = (feature, props) => ({
  ...feature,
  properties: { ...feature.properties, ...props },
});
