const komfovent = require("../lib/komfovent");
const request = require('request');
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
        this.on('input', function(msg) {
            if (typeof msg.payload !== 'string' || !msg.payload || msg.payload === '') {
                node.warn('Komfovent - empty ID received, quitting');
                return;
            }
            komfovent.login(
                node.komfoUser.credentials.username,
                node.komfoUser.credentials.password,
                node.komfoUser.ip,
                function(success, message) {
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
                        default:
                            error = true;
                            result = 'Mode ID not supported. Supported values om-[1:8] and oc-[1:2].'
                            break;
                    }

                    resultPayload[id] = buildResultNode(error, result, node);
                }
            });
        }
    }

    function readPage(node, page, actionFunction) {
        return new Promise(resolve => {
            getPage(node, page, function(resultGetPage, body) {
                if (!resultGetPage.error && body !== '') {
                    let scraped = cheerio.load(body);
                    actionFunction(node, scraped);
                }
                else {
                    node.warn('Komfovent error fetching page: http://' + node.komfoUser.ip);
                }

                resolve(page);
            });
        });
    }

    // function for fetching the page and scrape with cheerio, param page for subpages feature later
    function getPage(node, page, call) {
        request.post({
                url: 'http://' + node.komfoUser.ip + page,
                headers: {}
            },
            function(err, result, body) {
                node.debug('Komfovent -  logon result - Error ' + err);
                if (!err) {
                    call(result, body);
                }
                else {
                    node.warn('Error getting page');
                    call(buildResultNode(true, JSON.stringify(err), node), '');
                }
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