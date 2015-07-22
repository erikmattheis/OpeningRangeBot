fs = require('fs');

function log(file, message) {
	var datePart = "." + new Date().getFullYear() + "." + new Date().getMonth() + "." + new Date().getDate();
	fs.appendFile(file +'.log', JSON.stringify(message) + '\n', function (err) {
		if (err) {
			console.log('fs.appendFile', file, err);
		}
	});
}

exports.log = log;