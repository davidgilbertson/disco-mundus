export const arrayToMap = <T extends { id: any }>(arr: T[]): Map<T['id'], T> =>
  new Map(arr.map((item) => [item.id, item]));

export const upsert = <T extends { id: any }>(array: T[], newItem: T): T[] => {
  let itemExists = false;

  const nextArray = array.map((existingItem) => {
    if (existingItem.id === newItem.id) {
      itemExists = true;
      return newItem;
    }

    return existingItem;
  });

  if (!itemExists) nextArray.push(newItem);

  return nextArray;
};

export const updateFeatureProps = (
  feature: QuestionFeature,
  props: object
): QuestionFeature => ({
  ...feature,
  properties: { ...feature.properties, ...props },
});
