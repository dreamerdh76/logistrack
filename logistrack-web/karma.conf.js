// karma.conf.js
module.exports = function (config) {
  config.set({
    // Con builder nuevo no uses '@angular-devkit/build-angular' aquí
    frameworks: ['jasmine'],

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      // 👆 Nada de @angular-devkit/... ni @angular/build/... aquí
    ],

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-dev-shm-usage'],
      },
    },

    reporters: ['progress', 'kjhtml'],

    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      reporters: [{ type: 'html' }, { type: 'text-summary' }]
    },

    restartOnFileChange: true,
  });
};
