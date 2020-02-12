import React from 'react';
import App from './App';
import * as logUtils from './utils/logUtils';
import init from './init';

logUtils.logTime('Executing JavaScript');

init();

// TODO (davidg): split out React, I'd need to do it in App.tsx (too?)
import('react-dom').then(({ render }) => {
  render(<App />, document.getElementById('app'));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dmServiceWorker.ts').catch(console.error);
}
