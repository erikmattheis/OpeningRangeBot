"use strict";
var logger = require('../log/logger.js')

var emitter, openingRange, trades;

var config = {
	openingRangeStopLossFactor: .5,
	openingRangeTakeProfitFactor: 1.75
}

function Trader(emitter) {
	this.emitter = emitter;
	this.emitter.on("data", think);
	openingRange = [];

	trades = [];
}

exports.Trader = Trader;

function think(data) {
	//console.log("thinking", data);

	if (!trades[data.symbolName]) {
		trades[data.symbolName] = {};
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
		/*
		else if (position == null) {
			
		}
		*/
	}
	else if (data.type === "OHLC"
		&& openingRange[data.symbolName]
		&& typeof(trades[data.symbolName].position) === "undefined"
		&& data.dateTime.getHours() === 8
		&& data.dateTime.getMinutes() >= 35) {
		if (data.low > openingRange[data.symbolName].high) {
			trades[data.symbolName] = {
				position: "LONG",
				symbol: data.symbolName,
				stopLoss: openingRange[data.symbolName].high - (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].high + (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: openingRange[data.symbolName].close,
				data: data
			}
			logger.log("buy", trades[data.symbolName]);
		}
		else if (data.high < openingRange[data.symbolName].low) {
			trades[data.symbolName] = {
				position: "SHORT",
				symbol: data.symbolName,
				stopLoss: openingRange[data.symbolName].low + (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].low - (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: openingRange[data.symbolName].close,
				data: data
			}
			logger.log("buy", trades[data.symbolName]);
		}
	}
	else if (data.type === "OHLC"
		&& trades[data.symbolName]
		&& typeof(trades[data.symbolName].position) === "LONG") {

		// stop loss hit?
			if (trades[data.symbolName].stopLoss >= data.low) {
				sell(trades[data.symbolName], data, "stop loss");
			}
		// profit target hit? openingRangeTakeProfitFactor
			else if (trades[data.symbolName].profitTarget <= data.high) {
				sell(trades[data.symbolName], data, "profit target");
			}

		// profitable but declining?

		// end of session?
	}

	else if (data.type === "OHLC"
		&& trades[data.symbolName]
		&& typeof(trades[data.symbolName].position) === "SHORT") {

		// stop loss hit?
			if (trades[data.symbolName].stopLoss <= data.high) {
				sell(trades[data.symbolName], data, "stop loss");
			}
		// profit target hit? openingRangeTakeProfitFactor
			else if (trades[data.symbolName].profitTarget >= data.low) {
				sell(trades[data.symbolName], data, "profit target");
			}

		// profitable but declining?

		// end of session?
	}
}

function sell(trade, data, type) {
	trade.exit = data.close;
	trade.exitType = type;
	logger.log("sell", trades[data.symbolName]);
	trade.position = null;
}