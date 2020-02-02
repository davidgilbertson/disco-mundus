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
    'prettier/react',
  ],
  globals: {
    mapboxgl: 'writable',
    test: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  parser: 'babel-eslint',
  rules: {
    'prettier/prettier': 'error',
    'no-alert': 'off',
    'no-plusplus': 'off',
    'react/jsx-filename-extension': 'off',
    'react/state-in-constructor': 'off',
    'react/destructuring-assignment': 'off',
    'jsx-a11y/no-autofocus': 'off',
    'react/button-has-type': 'off',
    'no-console': [
      'error',
      {
        allow: ['info', 'warn', 'error', 'time', 'timeEnd'],
      },
    ],
  },
};
