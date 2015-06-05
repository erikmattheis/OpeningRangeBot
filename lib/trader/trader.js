"use strict";
var logger = require('../log/logger.js');

var emitter, broker, openingRange, trades;
var self = this;

var config = {
	openingRangeStopLossFactor: .5,
	openingRangeTakeProfitFactor: 1.75,
	profitableButDecliningFactor: .5
}

function Trader(emitter, broker) {
	self.broker = broker;
	this.emitter = emitter;
	this.emitter.on("data", think);

	openingRange = [];

	trades = [];

/*
	trades["IWM"] = {
		position: "SHORT",
		symbol: "IWM",
		largestProfit: Number.NEGATIVE_INFINITY,
		stopLoss: 121,
		profitTarget: 123,
		entry: 122.75
	}
	buy(trades["IWM"]);
	setTimeout(sellIWM, 4000)
	function sellIWM() {
		sell(trades["IWM"], {close:121}, "ANY");
	}
*/
}

exports.Trader = Trader;

function think(data) {
	if (data.end) {
		endDay();
		for (var i in trades) {
			delete trades[i];
		}
		return;
	}

	if (!trades[data.symbolName]) {
		trades[data.symbolName] = {
			position: null,
			wentLong: false,
			wentShort: false
		};
	}
	if (data.type === "trade"
		|| (data.type === "OHLC"
			&& self.broker.simulated
			&& data.dateTime.getHours() === 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() <= 34)) {

		if (/*1===1 || */(data.dateTime.getHours() === 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() <= 34)) {

			if (!openingRange[data.symbolName]) {
				openingRange[data.symbolName] = {
					high: Number.NEGATIVE_INFINITY,
					low: Number.POSITIVE_INFINITY
				};
				
			}

			var lastHigh = +openingRange[data.symbolName].high;
			var lastLow = +openingRange[data.symbolName].low;

			if (data.type === "trade") {

				openingRange[data.symbolName].high = (+data.last > openingRange[data.symbolName].high) ? +data.last : openingRange[data.symbolName].high;
				openingRange[data.symbolName].low = (+data.last < openingRange[data.symbolName].low) ? +data.last : openingRange[data.symbolName].low;

			}
			else {
				openingRange[data.symbolName].high = (+data.high > openingRange[data.symbolName].high) ? +data.high : openingRange[data.symbolName].high;
				openingRange[data.symbolName].low = (+data.low < openingRange[data.symbolName].low) ? +data.low : openingRange[data.symbolName].low;
			}

			if (openingRange[data.symbolName].high > lastHigh
				|| openingRange[data.symbolName].low < lastLow) {

				logger.log("opening-range", {symbol: data.symbolName, range: openingRange[data.symbolName], dateTime: data.dateTime.toString()});
			}
		}
	}
	/* TODO: only seems to make one trade per symbol instead of one long and one short trade per symbol */
	else if (data.type === "OHLC"
		&& openingRange[data.symbolName]
		&& !trades[data.symbolName].position
		&& data.dateTime.getHours() >= 8
		&& data.dateTime.getMinutes() >= 35) {
		// TODO: dry this out

		if (data.low > openingRange[data.symbolName].high
			&& trades[data.symbolName].wentLong === false) {
			
			trades[data.symbolName] = {
				wentLong: true,
				position: "LONG",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].high - (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: +openingRange[data.symbolName].high + (config.openingRangeTakeProfitFactor * (+openingRange[data.symbolName].high - +openingRange[data.symbolName].low)),
				entry: data.close
			}
			buy(trades[data.symbolName]);
		}
		else if (data.high < openingRange[data.symbolName].low
			&& trades[data.symbolName].wentShort === false) {
			trades[data.symbolName] = {
				wentShort: true,
				position: "SHORT",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].low + (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: +openingRange[data.symbolName].low - (config.openingRangeTakeProfitFactor * (+openingRange[data.symbolName].high - +openingRange[data.symbolName].low)),
				entry: data.close
			}
			buy(trades[data.symbolName]);
		}
	}
	else if (data.type === "OHLC"
		&& trades[data.symbolName]
		&& trades[data.symbolName].position === "LONG") {

		var profit = data.high - trades[data.symbolName].entry;
		trades[data.symbolName].largestProfit = profit > trades[data.symbolName].largestProfit ? profit : trades[data.symbolName].largestProfit;

	// stop loss hit?
		if (trades[data.symbolName].stopLoss >= data.low) {
			sell(trades[data.symbolName], data, "stop loss");
		}
	// profit target hit? openingRangeTakeProfitFactor
		else if (trades[data.symbolName].profitTarget <= data.high) {
			sell(trades[data.symbolName], data, "profit target");
		}

	// profitable but declining?
		else if (profit <= trades[data.symbolName].largestProfit / config.profitableButDecliningFactor) {
			sell(trades[data.symbolName], data, "profitable but declining");
		}

	}

	else if (data.type === "OHLC"
		&& trades[data.symbolName]
		&& trades[data.symbolName].position === "SHORT") {

		var profit = trades[data.symbolName].entry - data.low;
		trades[data.symbolName].largestProfit = profit > trades[data.symbolName].largestProfit ? profit : trades[data.symbolName].largestProfit;

		// stop loss hit?
		if (trades[data.symbolName].stopLoss <= data.high) {
			sell(trades[data.symbolName], data, "stop loss");
		}

		// profit target hit? openingRangeTakeProfitFactor
		else if (trades[data.symbolName].profitTarget >= data.low) {
			sell(trades[data.symbolName], data, "profit target");
		}

		// profitable but declining?
		else if (profit <= trades[data.symbolName].largestProfit / config.profitableButDecliningFactor) {
			sell(trades[data.symbolName], data, "profitable but declining");
		}

	}
	else if (data.dateTime
		&& data.dateTime.getHours() === 2
		&& data.dateTime.getMinutes() >= 57) {
		sell(trades[data.symbolName], data, "end of session");
	}
	//console.log(data);
	// oh no!
	/*
	{ type: 'quote',
  symbolName: 'IWM',
  exchangeId: 2,
  dateTime: Fri May 22 2015 07:48:52 GMT-0500 (Central Daylight Time),
  timestamp: 1432298932,
  open: undefined,
  high: undefined,
  low: undefined,
  close: undefined,
  volume: undefined }
  */
}

function buy(trade) {

	self.broker.buyOptions(trades[trade.symbol], function(err, result) {
		if (err) return logger.log("option-purchase-error", trade);
		trades[trade.symbol].optionName = result.optionName;
		trades[trade.symbol].optionEntryPrice = result.optionPrice;
		trades[trade.symbol].entryTime = new Date().getHours() + ":" + new Date().getMinutes();
		logger.log("buy", trades[trade.symbol]);
	});
	
}

function sell(trade, data, type) {

	self.broker.sellOptions(trades[trade.symbol], function(err, result) {
		if (err) return logger.log("option-purchase-error", trade);

		trade.exitTime = new Date().getHours() + ":" + new Date().getMinutes();
		trade.exit = data.close;
		trade.optionExitPrice = result.optionPrice;
		trade.profit = trade.position === "LONG" ? trade.exit - trade.entry : trade.entry - trade.exit;
		trade.optionProfit = trade.optionExitPrice - trade.optionEntryPrice;
		trade.exitType = type;
		logger.log("sell", trade);
		trades[trade.symbol].position = null;
	});

}
var tradeTotals = {
	"IWM": 0,
	"SPY": 0,
	"QQQ": 0,
	"AAPL": 0,
	"FB": 0
};
function endDay() {
	console.log('ending day');

	logResult("SPY");
	logResult("IWM");
	logResult("QQQ");
	logResult("AAPL");
	logResult("FB");

	logger.log("end", JSON.stringify(trades));
}

function logResult(symbol) {
	if (trades[symbol]
		&& !isNaN(parseFloat(trades[symbol].profit))
		&& isFinite(trades[symbol].profit)) {
		tradeTotals[symbol] += trades[symbol].profit;
		logger.log(symbol, {today: trades[symbol].profit, total: tradeTotals[symbol]});
	}
}