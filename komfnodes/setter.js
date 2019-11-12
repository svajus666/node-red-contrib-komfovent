const komfovent = require("../lib/komfovent");
const _stringCount = require("underscore.string/count");

const MODE_SPLIT = ',';
const ACTION_SPLIT = ':';
const ACTION_VALUE_PLACEHOLDER = '{}';

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
      this.error('Komfovent - Error, no login node exists - komfovent - setter.js: ' + err);
      return;
    }
    // validate settings when creating node
    if (typeof node.komfoUser === 'undefined'
            || !node.komfoUser
            || !node.komfoUser.credentials
            || !node.komfoUser.credentials.username
            || !node.komfoUser.credentials.password) {
      this.error('Komfovent - No credentials given! Missing config node details. komfovent setter.js l-17 :' + node.komfoUser);
      return;
    }
    if (typeof node.komfoUser.ip === 'undefined' || !node.komfoUser.ip) {
      this.error('Komfovent - No IP to komfovent unit found, cannot continue');
      return;
    }

    // what to do with payload incoming ///
    this.on('input', (msg) => {
      buildAjaxRequestBody(
          msg.payload,
          node.komfoUser.mode,
          (status, result) => {
            if (status == false) {
              msg.payload = { 'error': true, 'result': result, 'unit': node.komfoUser.ip };
              node.send(msg);
            } else {
              komfovent.login(
                  node.komfoUser.credentials.username,
                  node.komfoUser.credentials.password,
                  node.komfoUser.ip,
                  (status, message) => {
                    if (status == false) {
                      msg.payload = { 'error': true, 'result': message, 'unit': node.komfoUser.ip };
                      node.send(msg);
                    }
                    else {
                      // send http ajax to set mode, with callback below
                      komfovent.ajaxCall(
                          node.komfoUser.ip,
                          result,
                          (status, result) => {
                            if (status == true) {
                                msg.payload = { 'error': false, 'result': 'ok', 'unit': node.komfoUser.ip };
                            } else {
                                msg.payload = { 'error': true, 'result': result, 'unit': node.komfoUser.ip };
                            }
                            node.send(msg);
                          });
                    }
                  });
            }
          });
    }); // this on.input end
  }

  function buildAjaxRequestBody(payload, modeControls, callback) {
    if (!payload) {
        callback(false, 'Payload is empty.');
        return;
    }

    let modes = payload.split(MODE_SPLIT);

    //Backwards compatibility
    if (modes.length == 1 && modes[0].split(ACTION_SPLIT).length == 1) {
        let legacyAjaxCall = modeControls[modes[0]].activate;
        if (!legacyAjaxCall) {
            callback(false, 'Payload is invalid, unsupported mode [' + payload + ']');
        } else {
            callback(true, legacyAjaxCall);
        }
        return;
    }

    //New payload flow
    let ajaxBody = '';
    for (const controlString of modes) {
      let values = controlString.split(ACTION_SPLIT);

      //Check or we have at least two parts MODE and ACTION
      if (values.length < 2) {
        callback(false, 'Payload is invalid, it must contains mode and action and/or value e.g. away:activate, away:temperature:22');
        return;
      }

      //Check or we have this MODE configured
      let mode = values[0].trim();
      let configMode = modeControls[mode];
      if (!configMode) {
        callback(false, 'Mode [' + mode + '] is not configured.');
        return;
      }

      //Check or we have this ACTION for MODE configured
      let action = values[1].trim();
      let configAction = configMode[action];
      if (!configAction) {
        callback(false, 'Action [' + action + '] is not configured for mode[' + mode + '].');
        return;
      }

      //Check or we have same value count in config and payload
      let requiredValues = _stringCount(configAction, ACTION_VALUE_PLACEHOLDER);
      let haveValues = values.length - 2;
      if (requiredValues != haveValues) {
        callback(false, 'Action [' + action + '] for mode[' + mode + '] requires [' + requiredValues + '] values, payload contains [' + haveValues + '] values.');
        return;
      }

      //Fill values
      for (let i = 2; i < values.length; i++) {
        let value = values[i];
        //TODO: validate type required for request: date for holidays, number with decimal for temperature.
        if (value < 0) {
            callback(false, 'Action [' + action + '] for mode[' + mode + '] input value at position #' + (i - 1) + ' is negative [' + value + '].');
            return;
        }
        configAction = configAction.replace(ACTION_VALUE_PLACEHOLDER, parseInt(value));
      }

      ajaxBody += configAction;
    }

    if (ajaxBody === '') {
        callback(false, 'Empty ajax body after payload parsing, check your payload validity.');
    } else {
        callback(true, ajaxBody);
    }
  }

  RED.nodes.registerType('komfoventNode', komfoventNode);
};
