"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

	var config = {
		numOpeningMinutes: 2,
		riskFactor: .5
	}

var emitter, broker, openingRange, symbols;

function Trader(emitter, broker) {

	checkConfig();

	this.broker = broker;
	this.emitter = emitter;
	this.emitter.on("data", think);
	openingRange = [];
	symbols = [];

}

exports.Trader = Trader;

function checkConfig() {
	if (config.numOpeningMinutes < 1) {
		throw new Error("numOpeningMinutes must be greater than zero.")
	}
}

function think(data) {

	if (data.end) {

		

		for (var i in symbols) {
			if (symbols.hasOwnProperty(i)) {
				console.log(i);
				symbols[i].highs.length = 0;
				symbols[i].lows.length = 0;
				symbols[i].position = undefined;
				symbols[i].openAt = undefined;
				symbols[i].closeAt = undefined;
				symbols[i].hasOpened = false;
				symbols[i].openedAtMinuteNum = undefined;
				symbols[i].hasClosed = false;
				symbols[i].closedAtMinuteNum = undefined;

				console.log("end", i, symbols[i].profit);
			}
		}
		return;
	}
/*console.log(data)
{ type: undefined,
  symbolName: 'IWM',
  exchangeId: 1,
  dateTime: Fri Mar 13 2015 14:58:00 GMT-0500 (CDT),
  timestamp: undefined,
  open: 122.62,
  high: 122.63,
  low: 122.59,
  close: 122.59,
  ask: undefined,
  bid: undefined,
  volume: 156209 }
*/
	if (!symbols[data.symbolName]) {
		symbols[data.symbolName] = {
			highs: [],
			lows: [],
			position: undefined,
			openAt: undefined,
			closeAt: undefined,
			openedAtMinuteNum: undefined,
			closedAtMinuteNum: undefined,
			hasOpened: false,
			hasClosed: false,
			stopLossExecuted: false,
			profit: 0
		};

	}

	symbols[data.symbolName].highs.push(data.high);
	symbols[data.symbolName].lows.push(data.low);

	if (data.dateTime.getHours() === 8
		&& data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes
		&&  data.dateTime.getHours() < 15) {

		var minuteNum = data.dateTime.getMinutes() - 30;
		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName].lows);
		var higherLHighs = isHigherHighs(minuteNum, symbols[data.symbolName].highs);

		if (!symbols[data.symbolName].position) {
			if (!lowerLows && higherLHighs) {
				symbols[data.symbolName].position = "LONG";
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].closeAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt - ((symbols[data.symbolName].closeAt - symbols[data.symbolName].openAt) * config.riskFactor);
				console.log("long on", data.symbolName)
			}

			else if (lowerLows && !higherLHighs) {
				symbols[data.symbolName].position = "SHORT";
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].closeAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt + ((symbols[data.symbolName].closeAt - symbols[data.symbolName].openAt) * config.riskFactor);
				console.log("shorting", data.symbolName)
			}
		}


		if (!symbols[data.symbolName].hasClosed
			&& !symbols[data.symbolName].hasOpened
			&& symbols[data.symbolName].position === "LONG"
			&& data.low >= symbols[data.symbolName].openAt) {
				symbols[data.symbolName].hasOpened = true;
				console.log(1)
		}
		else if (!symbols[data.symbolName].hasClosed
			&& !symbols[data.symbolName].hasOpened
			&& symbols[data.symbolName].position === "SHORT"
			&& data.high <= symbols[data.symbolName].openAt) {
				symbols[data.symbolName].hasOpened = true;
				console.log(1)
		}
		// TODO: allow trader to buy and sell during same minute
		else if (symbols[data.symbolName].hasOpened
			&& !symbols[data.symbolName].hasClosed
			&& symbols[data.symbolName].position === "LONG") {

			if (data.low <= symbols[data.symbolName].stopLoss) {
				console.log(1.5)
				symbols[data.symbolName].hasClosed = true;
				symbols[data.symbolName].closedAtMinuteNum = minuteNum;
				symbols[data.symbolName].profit += symbols[data.symbolName].stopLoss - symbols[data.symbolName].openAt;
				console.log(2)
			}
			else if (data.high >= symbols[data.symbolName].closeAt) {
				symbols[data.symbolName].hasClosed = true;
				symbols[data.symbolName].closedAtMinuteNum = minuteNum;
				symbols[data.symbolName].profit += symbols[data.symbolName].closeAt - symbols[data.symbolName].stopLoss;
				console.log(2)
			}
		}
		else if (symbols[data.symbolName].hasOpened
			&& !symbols[data.symbolName].hasClosed
			&& symbols[data.symbolName].position === "SHORT") {
			
			if (data.high >= symbols[data.symbolName].stopLoss) {
				symbols[data.symbolName].hasClosed = true;
				symbols[data.symbolName].closedAtMinuteNum = minuteNum;
				symbols[data.symbolName].profit += symbols[data.symbolName].openAt - symbols[data.symbolName].stopLoss;
				console.log(2)
			}
			else if (data.high <= symbols[data.symbolName].closeAt) {
				symbols[data.symbolName].hasClosed = true;
				symbols[data.symbolName].closedAtMinuteNum = minuteNum;
				symbols[data.symbolName].profit += symbols[data.symbolName].stopLoss - symbols[data.symbolName].closeAt ;
				console.log(2)
			}

		}

	}
}

function isLowerLows(minuteNum, lows) {
	if (minuteNum < 2) {
		return false;
	}
	return lows[minuteNum - 1] < lows[minuteNum - 2];
}

function isHigherHighs(minuteNum, highs) {
	if (minuteNum < 2) {
		return false;
	}
	return highs[minuteNum - 1] > highs[minuteNum - 2];
}

function extendTrend(arr) {

	if (arr.length < 2) {
		return null;
	}

	// TODO: parameter to set trend length
	var next = arr[arr.length - 1] + (arr[arr.length - 1] - arr[arr.length - 2]);
	return util.money(next);
}

//console.log('extend:', extendTrend([1,2.5]))

function getMinuteHeight(bar) {
	return util.money(Math.abs(bar.high - bar.low));
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