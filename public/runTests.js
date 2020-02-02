import glob from 'glob';

global.window = {};

global.test = (name, func) => {
  try {
    func();
  } catch (err) {
    console.error(name, err);
  }
};

console.time('Test run complete');

// Yes, yes I could just use Jest
// TODO (davidg): https://www.npmjs.com/package/chokidar instead?
glob(
  'public/**/*.test.js',
  {absolute: true},
  (err, testFilePaths) => {
    if (err) {
      console.error(err);
      return;
    }

    if (!testFilePaths.length) {
      console.error('No test files found');
      return;
    }

    const testPromises = testFilePaths.map(testFilePath => {
      console.log('Running:', testFilePath);

      // Defined as an absolute path: https://nodejs.org/api/esm.html#esm_terminology
      return import(`file://${testFilePath}`);
    });

    Promise.all(testPromises).then(() => {
        console.timeEnd('Test run complete');
    });
  }
);

