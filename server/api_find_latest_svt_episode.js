'use strict';

const _ = require('lodash');
const chalk = require('chalk');
const SVT = require('../lib/find_latest_svt_episode.js');

const NoErr = null;

exports.findLatest = function(req, res, next) {

  const nameOfProgram = req.params.programName;
  if(!nameOfProgram) return res.status(400).send();

  SVT.findLatestSvtEpisode(nameOfProgram, function(err, latestEpisode) {
    if(err) console.log(err);
    if(latestEpisode) console.log(chalk.green(`Latest SVT ${latestEpisode.programTitle} video stream: ${latestEpisode.streamUrl}`));

    res.status(!err ? 200 : 404).send(latestEpisode);
  });
  
}