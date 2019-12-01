const komfovent = require("../lib/komfovent");
const cheerio = require('cheerio');

module.exports = function(RED) {
    'use strict';

    function komfoventNodeGet(config) {
        RED.nodes.createNode(this, config);
        // initial config of the node  ///
        var node = this;
        this.displayName = config.displayName;
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
        this.on('input', function(msg) {
            if (typeof msg.payload !== 'string' || !msg.payload || msg.payload === '') {
                node.warn('Komfovent - empty ID received, quitting');
                return;
            }
            komfovent.login(
                node.komfoUser.credentials.username,
                node.komfoUser.credentials.password,
                node.komfoUser.ip,
                (success, message) => {
                    if (success == false) {
                        msg.payload = buildResultNode(true, message, node);
                        node.send(msg);
                    }
                    else {
                        let idArray = msg.payload.split(",");
                        let resultPayload = {};
                        let promises = [];

                        //Read values from main page
                        let mainPageIdArray = idArray.filter(isMainPageId);
                        if (mainPageIdArray.length > 0) {
                            promises.push(readPage(node, '', readIdValuesAction(mainPageIdArray, resultPayload)));
                        }

                        //Read values from details page
                        let detPageIdArray = idArray.filter(isDetailsPageId);
                        if (detPageIdArray.length > 0) {
                            promises.push(readPage(node, '/det.html', readIdValuesAction(detPageIdArray, resultPayload)));
                        }

                        //Get selected mode status
                        let selectedModeArray = idArray.filter(isModeId);
                        if (selectedModeArray.length > 0) {
                            promises.push(readPage(node, '/i.asp', readModeStatusAction(selectedModeArray, resultPayload)));
                        }

                        //Wait for all pages parsing results
                        Promise.all(promises).then((pages) => {
                            //Backwards compatibility for single id
                            if (idArray.length == 1) {
                                msg.payload = resultPayload[idArray[0]];
                            }
                            else {
                                msg.payload = resultPayload;
                            }

                            node.send(msg);
                        }).catch(function(error) {
                            node.error('Error during page reading: ' + error);
                        });
                    }
                });
        }); // end this.on
    } // end komfovent node get

    function isDetailsPageId(id) {
        return id.indexOf('_') > 0;
    }

    function isMainPageId(id) {
        return !isDetailsPageId(id) && !isModeId(id);
    }

    function isModeId(id) {
        return id.indexOf('-') > 0;
    }

    //Read text from html node with provided ID.
    function readIdValuesAction(idArray, resultPayload) {
        return function(node, scraped) {
            idArray.forEach(id => {
                let msgResult = scraped('#' + id).text().trim();

                if (typeof msgResult === 'undefined' || !msgResult || msgResult === '') {
                    node.warn('Error, id not found: ' + id);
                    resultPayload[id] = buildResultNode(true, 'id not found', node);
                }
                else {
                    // seems like we got the data without errors
                    resultPayload[id] = buildResultNode(false, msgResult, node);
                }
            });
        }
    }

    //Get VF value and calculate mode status from it, calculation method taken from ventilation unit's page f-19.js script,
    //  based on firmware ver. 1.3.21.25
    function readModeStatusAction(idArray, resultPayload) {
        return function(node, scraped) {
            let v = scraped('VF').text().trim();

            idArray.forEach(id => {
                if (typeof v === 'undefined' || !v || v === '') {
                    node.warn('Error reading VF value.');
                    resultPayload[id] = buildResultNode(true, 'VF read error.', node);
                }
                else {
                    let error = false;
                    let result;

                    switch (id) {
                        case 'om-1':
                        case 'om-2':
                        case 'om-3':
                        case 'om-4':
                        case 'om-5':
                        case 'om-6':
                        case 'om-7':
                        case 'om-8':
                            let idNo = id.split('-')[1];
                            result = ((v >> 13 & 15) == idNo);
                            break;
                        case 'oc-1':
                            result = ((v >> 22 & 1) == 1);
                            break;
                        case 'oc-2':
                            result = ((v >> 23 & 1) == 1);
                            break;
                        case 'status-icons':
                            let vStatus = parseInt(v >> 0 & 8191);
                            result = {
                                'fan': (vStatus & 1 << 2) != 0,
                                'heat_exchanger': (vStatus & 1 << 3) != 0,
                                'heating': (vStatus & 1 << 4) != 0,
                                'cooling': (vStatus & 1 << 5) != 0,
                                'heater_blocking': (vStatus & 1 << 6) != 0,
                                'cooler_blocking': (vStatus & 1 << 7) != 0,
                                'flow_down': (vStatus & 1 << 8) != 0,
                                'free_heating': (vStatus & 1 << 9) != 0,
                                'free_cooling': (vStatus & 1 << 10) != 0
                            };
                            break;
                        default:
                            error = true;
                            result = 'Mode ID not supported. Supported values "status-icons", "om-[1:8]" and "oc-[1:2]".'
                            break;
                    }

                    resultPayload[id] = buildResultNode(error, result, node);
                }
            });
        }
    }

    function readPage(node, page, actionFunction) {
        return new Promise(resolve => {
            komfovent.getPage(
                node.komfoUser.ip,
                page,
                (status, message, body) => {
                    if (status == true && body !== '') {
                        let scraped = cheerio.load(body);
                        actionFunction(node, scraped);
                    }
                    else {
                        node.error('Komfovent error fetching page[' + page + '] on IP[' + node.komfoUser.ip +'] with error: ' + message);
                    }
                    resolve(page);
                });
        });
    }

    function buildResultNode(error, result, node) {
        let resultNode = {
            'error': error,
            'unit': node.komfoUser.ip
        };
        if (result !== 'undefined' ) {
            resultNode.result = result;
        }
        return resultNode;
    }

    RED.nodes.registerType('komfoventNodeGet', komfoventNodeGet);
};