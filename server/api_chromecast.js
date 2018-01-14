'use strict';

const _ = require('lodash');
const async = require('neo-async');
const chalk = require('chalk');
const Chromecast = require('../lib/play_on_chromecast.js');
const SVT = require('../lib/find_latest_svt_episode.js');

const NoErr = null;

exports.findAllDevices = function(req, res, next) {
  Chromecast.availableDevices(function(err, foundDevices) {
    if(err) console.log(err);
//    if(foundDevices) console.log(foundDevices);

    res.status(!err ? 200 : 500).send(!err ? foundDevices : err);
  });
}


exports.deviceAddress = function(req, res, next) {
  const deviceName = req.params.deviceName;
  if(!deviceName) return res.status(400).send();

  Chromecast.availableDevices(function(err, foundDevices) {
    if(err) {
      console.log(err);
      res.status(500).send();
    }

    const device = _.find(foundDevices, (dev) => (deviceName.localeCompare(dev.txtRecord.fn)));
    if(device) console.log("FOUND", deviceName);
    res.status(device ? 200 : 404).send(device ? device.adresses[0] : undefined);
  });
}

exports.castContentToDevice = function(req, res, next) {
  const nameOfProgram = req.params.program;
  const deviceName = req.params.deviceName;
  if(!deviceName || !nameOfProgram) return res.status(400).send();

  async.parallel([
    function(callback) {
      Chromecast.availableDevices(callback);
    },
    function(callback) {
      SVT.findLatestSvtEpisode(nameOfProgram, callback);
    }
  ], function allDone(err, results) {
    console.log(results);

    const [foundDevices, latestEpisode] = results;
    const device = _.find(foundDevices, (dev) => (deviceName.toLowerCase() == _.get(dev, 'txtRecord.fn', "").toLowerCase()));

    if(!device || !latestEpisode) return res.status(404).send((!latestEpisode ? 'Program' : 'Cromecast') + ' not available');

    Chromecast.castContentToDevice(latestEpisode, device.addresses[0], function(err, result) {
      res.status(err ? 500 : 200).send(result);
    });
  });
}

