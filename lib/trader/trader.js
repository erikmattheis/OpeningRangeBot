"use strict";
var logger = require('../log/logger.js')

var emitter, openingRange, trades;

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
		//console.log(data.dateTime.getHours(), data.dateTime.getMinutes())
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
		&& typeof(trades[data.symbolName].position) == 'undefined'
		&& data.dateTime.getMinutes() <= 35) {

		if (data.low > openingRange[data.symbolName].high) {
			trades[data.symbolName] = {
				position: "LONG",
				symbol: data.symbolName,
				data: data
			}
			logger.log("buy", trades[data.symbolName]);
		}
		else if (data.high < openingRange[data.symbolName].low) {
			trades[data.symbolName] = {
				position: "SHORT",
				symbol: data.symbolName,
				data: data
			}
			logger.log("buy", trades[data.symbolName]);
		}
	}
}