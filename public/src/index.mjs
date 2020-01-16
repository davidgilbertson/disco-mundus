import * as logUtils from './utils/logUtils.mjs';
import './app.mjs';

logUtils.logTime('Executing JavaScript');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dmServiceWorker.mjs').catch(console.error);
}
