// TODO (davidg): Proxy for this thing
export const logTime = msg => {
  console.info(msg, Math.round(performance.now()));
};

window.DM_VERSION = 6;

export const getAppInfo = async () => {
  const estimate = await navigator.storage.estimate();
  const usage = Math.round(estimate.usage / 1000000);
  const quota = Math.round(estimate.quota / 1000000);

  return [
    'Disco Mundus',
    '----------',
    `Version: ${window.DM_VERSION}`,
    `Storage used: ${usage.toLocaleString()} MB of ${quota.toLocaleString()} MB`,
  ].join('\n');
};