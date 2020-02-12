export const minsToMillis = (mins: number) => Math.round(mins * 60 * 1000);

export const daysToMillis = (days: number) =>
  Math.round(days * 24 * 60 * 60 * 1000);
