module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb',
    'airbnb/hooks',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
    'prettier/react',
  ],
  globals: {
    mapboxgl: 'writable',
    test: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    project: './tsconfig.json',
    tsconfigRootDir: '.',
  },
  parser: '@typescript-eslint/parser',
  rules: {
    'prettier/prettier': 'error',

    // Here's some rules from this dude: https://gist.github.com/1natsu172/a65a4b45faed2bd3fa74b24163e4256e
    /**
     * @bug https://github.com/benmosher/eslint-plugin-import/issues/1282
     * "import/named" temporary disable.
     */
    // 'import/named': 'off',
    /**
     * @bug?
     * "import/export" temporary disable.
     */
    // 'import/export': 'off',
    // 'import/prefer-default-export': 'off', // Allow single Named-export
    // 'no-unused-expressions': [
    //   'warn',
    //   {
    //     allowShortCircuit: true,
    //     allowTernary: true,
    //   },
    // ], // https://eslint.org/docs/rules/no-unused-expressions

    /**
     * @description rules of @typescript-eslint
     */
    // '@typescript-eslint/prefer-interface': 'off', // also want to use "type"
    '@typescript-eslint/explicit-function-return-type': 'off', // annoying to force return type

    '@typescript-eslint/ban-ts-ignore': 'off',
    'react/prop-types': 'off',

    /**
     * @description rules of eslint-plugin-react-hooks
     */
    // 'react-hooks/rules-of-hooks': 'error',
    // My preferences
    'no-alert': 'off',
    'no-plusplus': 'off',
    'react/jsx-filename-extension': 'off',
    // 'react/jsx-filename-extension': ['error', { extensions: ['.ts, .tsx'] }],
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
