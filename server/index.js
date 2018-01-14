'use strict;'

const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const sslify = require('express-sslify');

const httpProxy = require('http-proxy');
const _ = require('lodash');
const url = require('url');
const path = require('path');
const chalk = require('chalk');


//const logger = require('../lib/logger.js');
//const Twilio = require('../lib/twilio_sms.js');

const IS_PROD = (process.env.NODE_ENV == 'production');
const appDir = (IS_PROD ? 'dist' : 'dist');
const crashReportSmsNumber = process.env.CRASH_REPORT_SMS_NUMBER;

const NoErr = null;

const printableError = (err) => err && (err.stack || err.message || (_.isObject(err) ? JSON.stringify(err, null, 2) : err));
const sendCrashInfoBySms = _.once(function(eventName, err) {
  console.error(chalk.red(`${eventName}: ${printableError(err)}`));
  if(IS_PROD && crashReportSmsNumber) {
    console.log(chalk.red(`Sending crash stack by SMS to ${crashReportSmsNumber}...`));
//    Twilio.send(crashReportSmsNumber, `Server experienced ${eventName}: ${err.stack||err}`, function(err) {
//      if(err) console.error(printableError(err));
      process.exit(1);  // exit with failure
//    });
  } else {
    process.exit(1);    // exit with failure
  }
});
process.on('uncaughtException', _.partial(sendCrashInfoBySms, 'UNCAUGHT EXCEPTION'));
process.on('unhandledRejection', _.partial(sendCrashInfoBySms, 'UNHANDLED REJECTION'));

const app = express();
app.use(morgan('dev')); // was express.logger('dev') with Express 3.0
app.use(helmet());      // enable basic security headers

// "Force" browser to keep using HTTPS instead of HTTP
const NINETY_DAYS_IN_MILLISECONDS = 7776000000;
app.use(helmet.hsts({ maxAge: NINETY_DAYS_IN_MILLISECONDS }));  // set Strict-Transport-Security header

if(IS_PROD) {
  app.use(sslify.HTTPS({ trustProtoHeader: true })); // enable forced redirect HTTPS behind Heroku load-balancer
}

// Run the app by serving the static files in the dist directory
app.use(express.static(path.join(__dirname, '..', appDir)));

const svtPrograms = require('./api_find_latest_svt_episode.js');
app.get('/api/svt/latest/:programName', svtPrograms.findLatest);

const chromecast = require('./api_chromecast.js');
app.get('/api/chromecast/list', chromecast.findAllDevices);
app.get('/api/chromecast/devices/:deviceName/play/svt/latest/:program', chromecast.castContentToDevice);

// For all other requests, be stealthy and let the request time out
app.all('/*', function(req, res) {
  console.log(chalk.gray(`Letting request: ${req.method} ${req.url} go unanswered on purpose...`));
  // be stealthy, let the request time out
});

// Catch and handle errors
app.use(function(err, req, res, next) {
  const message = `Mathias Google Actions server error!\n` + 
                  `request: ${req.method} ${req.url}\n` +
                  `user-agent: ${_.get(req, "headers['user-agent']", "Unknown")}\n`;
  console.log(chalk.red(message));

  if(crashReportSmsNumber) {
    console.log(chalk.red(`Sending crash stack by SMS to ${crashReportSmsNumber}...`));
//    twilio.send(crashReportSmsNumber, `${message}\n${err.stack||err}`);
  }

  next(err);
});


// Start the app by listening on the default Heroku port
const port = process.env.PORT || 8080
app.listen(port);
console.log("Mathias Google Actions server, Listening to port", port);

