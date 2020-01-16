export const logTime = msg => {
  console.info(msg, Math.round(performance.now()));
};
