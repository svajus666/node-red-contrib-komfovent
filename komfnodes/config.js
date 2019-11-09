module.exports = function (RED) {
  'use strict';
  function komfoventConfig (config) {
    RED.nodes.createNode(this, config);
    // var node = this;
    this.username = config.username;
    this.password = config.password;
    this.ip = config.ip;
    this.displayName = config.displayName;
    this.siteName = config.siteName;
    // komfovent ajax values to pass for the modes (fireplace and kitchen must be supplied with timer values 283=80 for 80 mins run tim)
    var mode = {
      away: {
        activate: '3=1'
      },
      home: {
        activate: '3=2'
      },
      intensive: {
        activate: '3=3'
      },
      boost: {
        activate: '3=4'
      },
      kitchen: {
        activate: '282=15'
      },
      fireplace: {
        activate: '283=15'
      },
      override: {
        activate: '284=15'
      },
      eco: {
        activate: '285=1'
      },
      auto: {
        activate: '285=2'
      }
    };
    this.mode = mode;
  }
  RED.nodes.registerType('komfoventConfig', komfoventConfig, {
    credentials: {
      username: { type: 'text' },
      password: { type: 'password' }
    }
  }
  );
};
