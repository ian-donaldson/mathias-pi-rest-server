'use strict';

const _ = require('lodash');
const async = require('neo-async');
const chalk = require('chalk');
const request = require('request');
const cheerio = require('cheerio');

const NoErr = null;

exports.findLatestSvtEpisode = function(programName, callback) {
  async.waterfall([
    function findTheProgram(callback) {
      request(`https://www.svtplay.se/${programName.replace(/\s/g, '-').toLowerCase()}`, callback);
    },
    function findLatestEpisode(response, body, callback) {
      const $ = cheerio.load(body);
      const latestEpisodeElems = $('a.play_titlepage__latest-video');
      const latestEpisodeUrl = _.get(latestEpisodeElems, '[0].attribs.href');
      if(!latestEpisodeUrl) return callback('not-found1');

      request(`https://www.svtplay.se${latestEpisodeUrl}`, callback)
    },
    function findVideoStream(response, body, callback) {
      const $ = cheerio.load(body);
      const videoElems = $('video');
      const videoId = _.get(videoElems, '[0].attribs["data-video-id"]');
      if(!videoId) return callback('not-found2');

      request(`https://api.svt.se/videoplayer-api/video/${videoId}`, callback);
    },
    function formatResponse(response, body, callback) {
      const data = JSON.parse(body);
      const videoStream = _.find(data.videoReferences, {format: 'dashhbbtv'});
      if(!videoStream) return callback('not-found3');
//console.log(data);
      const programInfo = _.pick(data, ['programTitle', 'episodeTitle']);
      callback(NoErr, {...programInfo, streamUrl: videoStream.url, thumbnail: data.thumbnailMap.url});
    }
  ], callback);
}


