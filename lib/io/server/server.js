var express = require('express'),
	db = require("../../io/mongo/db.js"),
	config = require('../../config/config.json');
path = require('path');

var app = express();

app.get('/', function(req, res){
	var file = path.join(__dirname, "../../html/index.html");
	var r = fs.readFileSync(file, "utf8");
	res.send(r);
});

app.get('/data/:exchandeId/:symbol/:date', function(req, res) {

	/*
	var dateParts = req.params.date.split("-");

	if (dateParts.length !== 3
		|| isNaN(new Date(dateParts[2], dateParts[0], dateParts[1]).getTime())) {
		return res.send("Passed date not understood. Use mm-dd-yyyy");
	}
	*/

	var date = new Date(req.params.date);

	var bars = db.getSymbolOnDay(parseInt(req.params.exchandeId), req.params.symbol.toUpperCase(), date, function(err, result) {
		if (err) return console.log(err);
		res.send(JSON.stringify(result));
	});

});

function start() {
	app.listen(3000, function() {
		console.log("Express server listening on port", this.address().port);
	});
}
exports.start = start;