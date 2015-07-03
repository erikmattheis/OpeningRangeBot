"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js');

	var config = {
		numOpeningMinutes: 2
	}

var emitter, broker, openingRange, symbols;

function Trader(emitter, broker) {

	this.broker = broker;
	this.emitter = emitter;
	this.emitter.on("data", think);
	openingRange = [];
	symbols = [];

}

exports.Trader = Trader;
var debugStr = "";

function think(data) {

	if (data.end) {

		for (var i in symbols) {
			symbols[i].highs = [];
			symbols[i].lows = [];
			symbols[i].position = undefined;
			symbols[i].buyAt = undefined;
			symbols[i].sellAt = undefined;
			symbols[i].buyExecuted = false;
			symbols[i].sellExecuted = false;

			console.log("end", i, symbols[i].profit);
		}
		return;
	}

	if (!symbols[data.symbolName]) {
		symbols[data.symbolName] = {
			highs: [],
			lows: [],
			position: undefined,
			buyAt: undefined,
			sellAt: undefined,
			buyExecuted: false,
			sellExecuted: false,
			profit: 0
		};
	}

	if (data.dateTime.getHours() === 8
		&& data.dateTime.getMinutes() >= 30
		&& data.dateTime.getMinutes() < 30 + config.numOpeningMinutes) {
			symbols[data.symbolName].highs.push(data.high);
			symbols[data.symbolName].lows.push(data.low);
	}
	else if (!symbols[data.symbolName].position
		&& data.dateTime.getHours() === 8
		&& data.dateTime.getMinutes() >= 30  + config.numOpeningMinutes) {

		var minuteNum = data.dateTime.getMinutes() - 30;
		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName].lows);
		var higherLHighs = isHigherHighs(minuteNum, symbols[data.symbolName].highs);

		if (!symbols[data.symbolName].position) {
			if (!lowerLows && higherLHighs) {
				symbols[data.symbolName].position = "LONG";
				symbols[data.symbolName].buyAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].sellAt = extendTrend(symbols[data.symbolName].highs);
			}

			else if (lowerLows && !higherLHighs) {
				symbols[data.symbolName].position = "SHORT";
				symbols[data.symbolName].buyAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].sellAt = extendTrend(symbols[data.symbolName].lows);
			}
		}

		if (!symbols[data.symbolName].sellExecuted
			&& !symbols[data.symbolName].buyExecuted
			&& symbols[data.symbolName].position == "LONG"
			&& data.low >= symbols[data.symbolName].buyAt) {
				symbols[data.symbolName].buyExecuted = true;
		}
		else if (!symbols[data.symbolName].sellExecuted
			&& !symbols[data.symbolName].buyExecuted
			&& symbols[data.symbolName].position == "SHORT"
			&& data.high <= symbols[data.symbolName].buyAt) {
				symbols[data.symbolName].buyExecuted = true;
		}
		// TODO: allow trader to buy and sell during same minute
		else if (symbols[data.symbolName].buyExecuted
			&& !symbols[data.symbolName].sellExecuted
			&& symbols[data.symbolName].position == "LONG"
			&& data.high >= symbols[data.symbolName].sellAt) {
				symbols[data.symbolName].sellExecuted = true;
				symbols[data.symbolName].profit += symbols[data.symbolName].sellAt - symbols[data.symbolName].buyAt;
		}
		else if (symbols[data.symbolName].buyExecuted
			&& !symbols[data.symbolName].sellExecuted
			&& symbols[data.symbolName].position == "SHORT"
			&& data.low <= symbols[data.symbolName].sellAt) {
				symbols[data.symbolName].sellExecuted = true;
				symbols[data.symbolName].profit +=  symbols[data.symbolName].buyAt - symbols[data.symbolName].sellAt;
		}
	}
}

function isLowerLows(minuteNum, lows) {
	return lows[minuteNum - 1] < lows[minuteNum - 2];
}

function isHigherHighs(minuteNum, highs) {
	return highs[minuteNum - 1] > highs[minuteNum - 2];
}

function extendTrend(arr) {
	return arr[arr.length - 1] + (arr[arr.length - 1] - arr[arr.length - 2]);
}

//console.log('extend:', extendTrend([1,2.5]))

function getMinuteHeight(bar) {
	return Math.abs(bar.high - bar.low);
}

/*

{ type: undefined,
  symbolName: 'IWM',
  exchangeId: 1,
  dateTime: Fri Mar 13 2015 14:57:00 GMT-0500 (CDT),
  timestamp: undefined,
  open: 122.7499,
  high: 122.75,
  low: 122.62,
  close: 122.62,
  ask: undefined,
  bid: undefined,
  volume: 231925 }

*/