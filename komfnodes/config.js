module.exports = function (RED) {
  'use strict';
  function komfoventConfig(config) {
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
        activate: '3=1&',
        heater_on: '271=1&',
        heater_off: '271=0&',
        temperature: '263={}&'
      },
      normal: {
        activate: '3=2&',
        heater_on: '272=1&',
        heater_off: '272=0&',
        temperature: '264={}&'
      },
      intensive: {
        activate: '3=3',
		heater_on: '273=1&',
        heater_off: '273=0&',
        temperature: '265={}&'
      },
      boost: {
        activate: '3=4',
		heater_on: '274=1&',
        heater_off: '274=0&',
        temperature: '266={}&'
      },
      kitchen: {
        activate: '282=15',
		heater_on: '275=1&',
        heater_off: '275=0&',
        temperature: '267={}&'
      },
      fireplace: {
        activate: '283=15',
		heater_on: '276=1&',
        heater_off: '276=0&',
        temperature: '268={}&'
      },
      override: {
        activate: '284=15',
		heater_on: '277=1&',
        heater_off: '277=0&',
        temperature: '269={}&',
		delayed_start: '805={}&',
		delayed_stop: '804={}&'
      },
	  holidays: {
		heater_on: '278=1&',
        heater_off: '278=0&',
        temperature: '270={}&'
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
  });
};
