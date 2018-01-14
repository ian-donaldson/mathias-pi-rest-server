'use strict';

const _ = require('lodash');
const async = require('neo-async');
const chalk = require('chalk');
const Client = require('castv2-client').Client;
const MediaReceiver = require('castv2-client').DefaultMediaReceiver;
const mdns = require('mdns');

const NoErr = null;

exports.availableDevices = function(callback) {

  const sequence = [  // see https://stackoverflow.com/questions/29589543/raspberry-pi-mdns-getaddrinfo-3008-error/29801860
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[4]}),
    mdns.rst.makeAddressesUnique()
  ];

  const browser = mdns.createBrowser(mdns.tcp('googlecast'), {resolverSequence: sequence});
  browser.start();
  
  const foundDevices = [];

  browser.on('serviceUp', function(service) {
    console.log(`Found device "${service.txtRecord.fn}" (${service.name}) at ${service.addresses[0]}:${service.port}`);
    foundDevices.push(service);
    sendResult();
  });

  const oneShotCallback = _.once(callback);
  const sendResult = _.debounce(function() {
    browser.stop();
    oneShotCallback(NoErr, foundDevices);
  }, 250);
}


exports.castContentToDevice = function(content, host, callback) {


  MediaReceiver.APP_ID = '3F70D486'; // SVT player, see https://github.com/octoblu/meshblu-chromecast/blob/master/chromecast-apps.json

  const media = {
  	// Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
    contentId: content.streamUrl,
//        contentType: 'video/mp4',
//        streamType: 'BUFFERED', // or LIVE

    // Title and cover displayed while buffering
    metadata: {
      type: 0,
      metadataType: 0,
      title: content.programTitle, 
      images: [
//            { url: content.thumbnail }
      ]
    }   
  };

  const client = new Client();
  const allDone = _.once(function() {
    callback(...arguments);
  });

  async.waterfall([
    function(callback) {
      client.connect(host, callback);
    },
    function(callback) {
      console.log('Connected, launching app ...');
      client.launch(MediaReceiver, callback);
    },
    function(player, callback) {
      console.log('App "%s" launched, loading media %s ...', player.session.displayName, media.contentId);

      player.load(media, { autoplay: true }, function(err, status) {
        console.log('Media loaded, playerState=%s', status.playerState);
        if(err) return callback(err);
      });

      player.on('status', function(status) {
        console.log(`Status broadcast, playerState=${status.playerState}`);
        console.log(chalk.gray(JSON.stringify(status, null, 2)));
        if(status.playerState == 'PLAYING') return callback(NoErr, status);
        if(status.idleReason == 'FINISHED') {
          client.stop(player, () => {
            console.log("FINISHED!");
            client.close();
          });
        }
      });
    }
  ], allDone);

  client.on('error', function(err) {
    console.log('Error: %s', err.message);
    client.close();
    allDone(err);
  });
}


