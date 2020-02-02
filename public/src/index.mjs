import React from 'react';
import { render } from 'react-dom';
import App from './app.mjs';
import * as logUtils from './utils/logUtils.mjs';

logUtils.logTime('Executing JavaScript');

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dmServiceWorker.mjs').catch(console.error);
}
