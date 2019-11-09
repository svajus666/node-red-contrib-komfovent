const request = require("request");

const komfovent = {
    login: function(username, password, ip, callback) {
        var logonBody = '1=' + username + '&' + '2=' + password;
        request.post({
            url: 'http://' + ip,
            headers: { 'Content-Length': logonBody.length },
            body: logonBody
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
    }
}

module.exports = komfovent;