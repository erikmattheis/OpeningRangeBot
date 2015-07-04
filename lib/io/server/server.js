var express = require('express'),
	db = require("../../io/mongo/db.js"),
	config = require('../../config/config.json');
path = require('path');

var app = express();

app.use('/static', express.static(path.join(__dirname, "../../html/static")));

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

		var OHLCs = [];

		for (var i = 0; i < result.length; i++) {
			OHLCs.push([
				result[i].dateTime.getTime(),
				result[i].open,
				result[i].high,
				result[i].low,
				result[i].close
				]);
		}
		res.send(JSON.stringify(OHLCs));
	});

});

function start() {
	app.listen(3001, function() {
		console.log("Express server listening on port", this.address().port);
	});
}
exports.start = start;