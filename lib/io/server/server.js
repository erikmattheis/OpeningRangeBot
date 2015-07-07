var async = require("async"),
	path = require("path"),
	express = require("express"),
	db = require("../../io/mongo/db.js"),
	simulator = require("../../io/simulator/simulator.js"),
	trader = require("../../trader/ohlcTrader.js"),
	config = require('../../config/config.json');

var app = express(),
	trader2 = new trader.Trader(null, null);

app.use('/static', express.static(path.join(__dirname, "../../html/static")));

app.get('/', function(req, res){
	var file = path.join(__dirname, "../../html/index.html");
	var r = fs.readFileSync(file, "utf8");
	res.send(r);
});

/*
async.waterfall([
    function(callback) {
        callback(null, 'one', 'two');
    },
    function(arg1, arg2, callback) {
      // arg1 now equals 'one' and arg2 now equals 'two'
        callback(null, 'three');
    },
    function(arg1, callback) {
        // arg1 now equals 'three'
        callback(null, 'done');
    }
], function (err, result) {
    // result now equals 'done'
});
*/

app.get('/data/:exchandeId/:symbol/:date', function(req, res) {

	/*
	var dateParts = req.params.date.split("-");

	if (dateParts.length !== 3
		|| isNaN(new Date(dateParts[2], dateParts[0], dateParts[1]).getTime())) {
		return res.send("Passed date not understood. Use mm-dd-yyyy");
	}
	*/

	var date = new Date(req.params.date);

	async.waterfall([
		function(callback) {

			db.getSymbolOnDay(parseInt(req.params.exchandeId), req.params.symbol.toUpperCase(), date, function(err, result) {
				if (err) return callback(err);

				var ohlcs = [];

				for (var i = 0; i < result.length; i++) {
					ohlcs.push([
						result[i].dateTime.getTime(),
						result[i].open,
						result[i].high,
						result[i].low,
						result[i].close
						]);
				}
				callback(null, ohlcs, result);
			});
    	},
		function(ohlcs, bars, callback) {

			trader.getTrades(bars, function(err, result) {
				console.log("GOT TRADES", result)
				var results = {
					ohlcs: ohlcs,
					trades: result
				}
				res.send(JSON.stringify(results));
				callback(results);
			});

			
		},
		function(result) {
			callback(null, result);
		}]
	);
});

function start(trader) {
	app.listen(3001, function() {
		console.log("Express server listening on port", this.address().port);
	});
}
exports.start = start;