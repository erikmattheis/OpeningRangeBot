var async = require("async"),
	path = require("path"),
	express = require("express"),
	db = require("../../io/mongo/db.js"),
	simulator = require("../../io/simulator/simulator.js"),
	trader = require("../../trader/optionsStrategyTrader2.js"),
	config = require("../../config/config.json")

var app = express();

app.use('/static', express.static(path.join(__dirname, "../../html/static")));

app.get('/', function(req, res){
	var file = path.join(__dirname, "../../html/index.html");
	var r = fs.readFileSync(file, "utf8");
	res.send(r);
});

/*
trader.getStraddleOHLCs("IWM", new Date(2015, 1, 3), new Date(2015, 1, 9), function(err, result) {
	console.log("Testing IWM")
	console.log(JSON.stringify(result));
	process.exit();
	res.send(JSON.stringify(result));
	res.end();
});
*/

app.get('/straddle/:symbol/:date', function(req, res) {

	var date = new Date(req.params.date);
	var nextDay = util.getNextDay(date);
	//new Date(2015, 1, 3)new Date(2015, 1, 9)
	trader.getStraddleOHLCs(req.params.symbol.toUpperCase(), date, nextDay, function(err, bars) {
			var ohlcs = [];
			for (var i = 0; i < bars.length; i++) {
				if (i === 0)
				console.log("first bar in straddle", bars[i].dateTime)
				ohlcs.push([
					bars[i].dateTime.getTime(),
					bars[i].open,
					bars[i].high,
					bars[i].low,
					bars[i].close
					]);
			}
		res.send(JSON.stringify(ohlcs));
		res.end();
	});
});

app.get('/trades/:symbol/:date', function(req, res) {

	var date = new Date(req.params.date);
	//new Date(2015, 1, 3)new Date(2015, 1, 9)
	trader.getTrades(req.params.symbol.toUpperCase(), date, function(err, trades) {
		if (err) { return console.log("trader.getTrades error:", err); }

		if (!trades || !trades.putPurchaseTime) {
			var points = [
				[null, null]
			];
			return res.send(JSON.stringify(points));
		}
		
		var points = [
			[trades.putPurchaseTime.getTime(), trades.combinedPurchasePrice],
			[trades.putSaleTime.getTime(), trades.combinedSalePrice],
		];
		console.log("trades.putPurchaseTime", trades.putPurchaseTime)
		res.send(JSON.stringify(points));
		res.end();
	});
});

/*
trader.getTrades("IWM", new Date(2015, 2, 1), function(err, trades) {
	if (err) { console.log("trader.getTrades error:", err); }
	if (!trades) {
		return console.log("no trades")
	}
	var points = [
		[trades.putPurchaseTime.getTime(), trades.combinedPurchasePrice],
		[trades.putSaleTime.getTime(), trades.combinedSalePrice],
	];
	console.log("sending", points)
});
*/

app.get('/option-names/:symbol/:date', function(req, res) {
	var date = new Date(req.params.date);
	db.getAvailableOptionNames(req.params.symbol.toUpperCase(), date, function(err, result) {
		res.send(JSON.stringify(result));
	})
});
/*
db.getAvailableOptionNames("IWM", new Date(2015, 4, 5), function(err, result) {
	console.log('got result')
})
*/
app.get('/data/:exchandeId/:symbol/:date', function(req, res) {

	var date = new Date(req.params.date);

	db.getSymbolOnDay(parseInt(req.params.exchandeId), req.params.symbol.toUpperCase(), date, function(err, bars) {
		if (err) return console.log(err);
		var ohlcs = [];

		for (i = 0; i < bars.length; i++) {
			ohlcs.push([
				bars[i].dateTime.getTime(),
				bars[i].open,
				bars[i].high,
				bars[i].low,
				bars[i].close
				]);
		}
		res.send(JSON.stringify(ohlcs));
	});
/*
	async.waterfall([
		function(callback) {


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
*/
});

function start(trader) {
	app.listen(config.serverPort, function() {
		console.log("Express server listening on port", this.address().port);
	});
}
exports.start = start;