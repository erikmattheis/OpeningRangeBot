"use strict";
var logger = require('../log/logger.js'),
broker = require('../io/exchange/TradeKing/stream.js')

var emitter, openingRange, trades;

var config = {
	openingRangeStopLossFactor: .5,
	openingRangeTakeProfitFactor: 1.75,
	profitableButDecliningFactor: .5
}

/* TODO: pass broker from another module */
function Trader(emitter) {

	this.emitter = emitter;
	this.emitter.on("data", think);

	openingRange = [];

	trades = [];

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

}

exports.Trader = Trader;

function think(data) {

	if (!trades[data.symbolName]) {
		trades[data.symbolName] = {
			position: null
		};
	}
	if (data.type === "trade") {

		if (/*1===1 || */(data.dateTime.getHours() == 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() <= 34)) {

			if (!openingRange[data.symbolName]) {
				openingRange[data.symbolName] = {
					high: Number.NEGATIVE_INFINITY,
					low: Number.POSITIVE_INFINITY
				};
				
			}

			var lastHigh = openingRange[data.symbolName].high;
			var lastLow = openingRange[data.symbolName].low;

			openingRange[data.symbolName].high = (data.last > openingRange[data.symbolName].high) ? data.last : openingRange[data.symbolName].high;
			openingRange[data.symbolName].low = (data.last < openingRange[data.symbolName].low) ? data.last : openingRange[data.symbolName].low;

			if (openingRange[data.symbolName].high > lastHigh
				|| openingRange[data.symbolName].low < lastLow) {

				logger.log("opening-range", {symbol: data.symbolName, range: openingRange[data.symbolName], dateTime: data.dateTime.toString()});
			}
		}
	}
	else if (data.type === "OHLC"
		&& openingRange[data.symbolName]
		&& !trades[data.symbolName].position
		&& data.dateTime.getHours() >= 8
		&& data.dateTime.getMinutes() >= 35) {
		// TODO: dry this out
		if (data.low > openingRange[data.symbolName].high) {
			trades[data.symbolName] = {
				position: "LONG",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].high - (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].high + (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: data.close
			}
			buy(trades[data.symbolName]);
		}
		else if (data.high < openingRange[data.symbolName].low) {
			trades[data.symbolName] = {
				position: "SHORT",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].low + (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].low - (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
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
}

function buy(trade) {

	broker.buyOptions(trades[trade.symbol], function(err, result) {
		if (err) return logger.log("option-purchase-error", trade);
		trades[trade.symbol].optionName = result.optionName;
		trades[trade.symbol].optionEntryPrice = result.optionPrice;
		trades[trade.symbol].entryTime = new Date().getHours() + ":" + new Date().getMinutes();
		logger.log("buy", trades[trade.symbol]);
	});
	
}

function sell(trade, data, type) {

	broker.sellOptions(trades[trade.symbol], function(err, result) {
		if (err) return logger.log("option-purchase-error", trade);

		trade.exitTime = new Date().getHours() + ":" + new Date().getMinutes();
		trade.optionExitPrice = result.optionPrice;
		trade.profit = trade.position === "LONG" ? trade.exit - trade.optionEntryPrice : trade.optionEntryPrice - trade.exit;
		trade.optionProfit = trade.optionExitPrice - trade.optionEntryPrice;
		trade.exit = data.close;
		trade.exitType = type;
		logger.log("sell", trade);
		trades[trade.symbol].position = null;
	});

}