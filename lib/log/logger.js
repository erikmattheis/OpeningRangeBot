fs = require('fs');

function log(message) {
	fs.appendFile('log.log', JSON.stringify(message) + '\n', function (err) {
		console.log(err);
	});
}

exports.log = log;