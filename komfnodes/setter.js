const komfovent = require("../lib/komfovent");
const request = require('request');

module.exports = function (RED) {
  'use strict';

  function komfoventNode (config) {
    RED.nodes.createNode(this, config);

    // initial config of the node  ///
    var node = this;

    // Retrieve the config node
    try {
      this.komfoUser = RED.nodes.getNode(config.user);
    }
    catch (err) {
      this.error('Komfovent - Error, no login node exists - komfovent - setter.js l-13: ' + err);
      this.debug('Komfovent - Couldnt get config node : ' + this.komfoUser);
    }
    // validate settings when creating node
    if (typeof node.komfoUser === 'undefined' || !node.komfoUser || !node.komfoUser.credentials.username || !node.komfoUser.credentials.password) {
      this.warn('Komfovent - No credentials given! Missing config node details. komfovent setter.js l-17 :' + node.komfoUser);
      return;
    }
    if (typeof node.komfoUser.ip === 'undefined' || !node.komfoUser.ip) {
      this.warn('Komfovent - No IP to komfovent unit found, cannot continue');
      return;
    }

    // what to do with payload incoming ///
    this.on('input', function (msg) {
      // validate input, right mode and lookup code
      let pay = msg.payload.toLowerCase();
      let mode = {
        name: pay,
        code: ''
      };

      let modeControls = node.komfoUser.mode[pay];
      if (modeControls === 'undefined' || !modeControls) {
        msg.payload = { Error: true, details: 'unsupported mode', unit: node.komfoUser.ip };
        node.send(msg);
      } else {
        mode.code = modeControls.activate;

        komfovent.login(
          node.komfoUser.credentials.username,
          node.komfoUser.credentials.password,
          node.komfoUser.ip,
          function (success, message) {
            if (success == false) {
              msg.payload = { error: true, details: message, unit: node.komfoUser.ip };
              node.send(msg);
            }
            else {
              // send http ajax to set mode, with callback below
              komfoMode(mode, node, msg, function (result) {
                msg.payload = result;
                node.send(msg);
              }); // komfomode end
            }
          }); // login end
      }
    }); // this on.input end
  }

  // function for setting mode
  function komfoMode (mode, node, msg, call) {
    node.debug('Payload start function ' + mode.code);
    request.post({
      url: 'http://' + node.komfoUser.ip + '/ajax.xml',
      headers: { 'Content-Length': mode.code.length },
      body: mode.code
    }, function (err, result) {
      node.debug('Komfovent - set-mode result - Error ' + err);
      // node.debug('komfovent result is in komfo - Body ' + result.body)
      if (err) {
        node.warn('Komfovent - Problem setting mode : ' + JSON.stringify(err));
        if (err.errno === 'ENOTFOUND' || err.errno === 'EHOSTDOWN') {
          node.warn('Komfovent - cannot reach unit for set-mode, unit not found - ' + node.komfouser.ip);
        }
        else {
          node.warn('unknown connection issue' + node.komfoUser.ip);
        }
      }
      else {
        // for now assuming this means mode has been set
        node.debug('Komfovent setmode return status: ' + result.statusCode);
        // node.debug('Komfovent set mode - returned body \n\r' + result.body);
        return call({ error: false, result: mode.name, unit: node.komfoUser.ip });
      }
    });
  }

  RED.nodes.registerType('komfoventNode', komfoventNode);
};
