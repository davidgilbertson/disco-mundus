import { Store } from 'react-recollect';

export const getPageStats = (componentStore: Store) => {
  const now = componentStore.sessionQueue.size;
  let unseen = 0;

  componentStore.questionFeatures.forEach((feature) => {
    const isInQueue = componentStore.sessionQueue.has(feature.id);

    if (!feature.properties.nextAskDate && !isInQueue) {
      unseen++;
    }
  });

  const later = componentStore.questionFeatures.size - unseen - now;

  return { now, later, unseen };
};
