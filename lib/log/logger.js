fs = require('fs');

function log(file, message) {
	var datePart = "." + new Date().getFullYear() + "." + new Date().getMonth() + "." + new Date().getDate();
	fs.appendFile(file + datePart + '.log', JSON.stringify(message) + '\n', function (err) {
		console.log(err);
	});
}

exports.log = log;