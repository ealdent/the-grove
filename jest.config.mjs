export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/greenhouse-todo/tests/jest.setup.js'],
  transform: {},
  moduleNameMapper: {
    // n8ao statically imports `postprocessing` for a pass we never use. The
    // browser resolves that to a local shim via the importmap in
    // greenhouse-todo/index.html; do the same here so importing app.js
    // in a test doesn't need the real 350 kB library installed.
    '^postprocessing$': '<rootDir>/greenhouse-todo/vendor/postprocessing-pass-shim.js',
  },
};
