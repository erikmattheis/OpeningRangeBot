var async = require("async"),
	path = require("path"),
	express = require("express"),
	db = require("../../io/mongo/db.js"),
	simulator = require("../../io/simulator/simulator.js"),
	trader = require("../../trader/optionsStrategyTrader2.js")

var app = express(),
	trader2 = new trader.Trader(null, null);

app.use('/static', express.static(path.join(__dirname, "../../html/static")));

app.get('/', function(req, res){
	var file = path.join(__dirname, "../../html/index.html");
	var r = fs.readFileSync(file, "utf8");
	res.send(r);
});

app.get('/straddle/:symbol/:date', function(req, res) {

	trader.getStraddleOHLCs(req.params.symbol.toUpperCase(), new Date(2015, 1, 3), new Date(2015, 1, 9), function(err, result) {
		res.send(JSON.stringify(results));
		res.end();
	});
});

app.get('/data/:exchandeId/:symbol/:date', function(req, res) {

	var date = new Date(req.params.date);

	async.waterfall([
		function(callback) {

			db.getSymbolOnDay(parseInt(req.params.exchandeId), req.params.symbol.toUpperCase(), date, function(err, result) {
				if (err) return callback(err);
				callback(null, result);
			});
    	},
		function(bars, callback) {
			trader.getTrades(bars, function(err, result) {

			    for (var i in result) {

			    	if (result.hasOwnProperty(i)
			    		&& result[i].purchaseTime) {
	
		    			var trades = [{
		                    x: result[i].purchaseTime.getTime(),
		                    y: result[i].purchasePrice,
		                    position: result[i].position
		                }, {
		                    x: result[i].saleTime.getTime(),
		                    y: result[i].salePrice
			                }];
			        }
			    }

			    var ohlcs = [];

				for (i = 0; i < bars.length && bars[i].dateTime.getTime() <= trades[1].x; i++) {
					ohlcs.push([
						bars[i].dateTime.getTime(),
						bars[i].open,
						bars[i].high,
						bars[i].low,
						bars[i].close
						]);
				}

				var results = {
					ohlcs: ohlcs,
					trades: trades
				}
				res.send(JSON.stringify(results));
				res.end();
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