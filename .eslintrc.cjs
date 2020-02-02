module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb',
    'airbnb/hooks',
    'plugin:prettier/recommended',
  ],
  globals: {
    mapboxgl: "writable",
    test: "readonly",
  },
  ignorePatterns: [
    'runTests.mjs',
    'nomodule.js',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'error',
    'no-alert': 'off',
    'no-console': ['error', {
      allow: ['info', 'warn', 'error', 'time', 'timeEnd']
    }],
  },
};
