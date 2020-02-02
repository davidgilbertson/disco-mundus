import React from 'react';
import { render } from 'react-dom';
import App from './App';
import * as logUtils from './utils/logUtils';

logUtils.logTime('Executing JavaScript');

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dmServiceWorker.js').catch(console.error);
}
