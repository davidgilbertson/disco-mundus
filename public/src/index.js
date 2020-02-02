import React from 'react';
import { render } from 'react-dom';
import App from './App';
import * as logUtils from './utils/logUtils';
import init from './init';

logUtils.logTime('Executing JavaScript');

init();

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dmServiceWorker.js').catch(console.error);
}
