const request = require("request");

const komfovent = {
    login: function(username, password, ip, callback) {
        var logonBody = '1=' + username + '&' + '2=' + password;
        request.post({
            'url': 'http://' + ip,
            'headers': { 'Content-Length': logonBody.length },
            'body': logonBody
        }, function(err, result, body) {
            if (err) {
                if (err.errno === 'ENOTFOUND' || err.errno === 'EHOSTDOWN') {
                    callback(false, 'address not found for unit');
                }
                else {
                    callback(false, JSON.stringify(err));
                }
            }
            else if (body.indexOf('Incorrect password!') >= 0) {
                callback(false, 'wrong password ');
            }
            else {
                // for now, assuming this means we're logged on
                callback(true, 'logged on');
            }
        });
    },
    ajaxCall: function (ip, body, callback) {
        request.post({
          'url': 'http://' + ip + '/ajax.xml',
          'headers': { 'Content-Length': body.length },
          'body': body
        }, (err, result) => {
            if (err) {
                if (err.errno === 'ENOTFOUND' || err.errno === 'EHOSTDOWN') {
                    callback(false, 'Komfovent - cannot reach unit for set-mode, unit not found - ' + ip)
                }
                else {
                    callback(false, 'Komfovent - unknown connection issue on ' + ip)
                }
            }
            else {
                callback(true, result);
            }
        });
    },
    getPage: function(ip, page, callback) {
        request.post({
            url: 'http://' + ip + page,
            headers: {}
        },
        function(err, result, body) {
            if (err) {
                callback(false, JSON.stringify(err), '');
            }
            else {
                callback(true, result, body);
            }
        });
    }
}

module.exports = komfovent;