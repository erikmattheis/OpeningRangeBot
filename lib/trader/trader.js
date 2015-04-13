"use strict";
var logger = require('../log/logger.js')

var emitter, openingRange;

function Trader(emitter) {
	this.emitter = emitter;
	this.emitter.on("data", think);
	openingRange = {
		high: Number.NEGATIVE_INFINITY,
		low: Number.POSITIVE_INFINITY
	}
}

exports.Trader = Trader;

function think(data) {
	//console.log("thinking", data);
	if (data.type === "trade") {
		console.log(data.dateTime.getHours(), data.dateTime.getMinutes())
		if (data.dateTime.getHours() === 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() <= 34) {
			var lastHigh = openingRange.high;
			var lastLow = openingRange.low;

			openingRange.high = (data.last > openingRange.high) ? data.last : openingRange.high;
			openingRange.low = (data.last < openingRange.low) ? data.last : openingRange.low;

			if (openingRange.high !== lastHigh
				|| openingRange.low !== lastLow) {
					logger.log("opening-range", {openingRange: openingRange, dateTime: data.dateTime.toString()});
			}
		}
	}
}