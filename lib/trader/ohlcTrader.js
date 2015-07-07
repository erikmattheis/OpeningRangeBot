"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

	var config = {
		numOpeningMinutes: 4,
		riskFactor: .5,
		shyFactor: 1
	}
/*

*/

var emitter, broker, openingRange, symbols;

function Trader(emitter, broker) {

	checkConfig();

	if (broker) {
		this.broker = broker;
	}
	if (emitter) {
		this.emitter = emitter;
		this.emitter.on("data", think);
	}
	
	openingRange = [];
	symbols = [];

}

exports.Trader = Trader;

function checkConfig() {
	if (config.numOpeningMinutes < 1) {
		throw new Error("numOpeningMinutes must be greater than zero.")
	}
}

function getTrades(bars, callback) {
	for (var i = 0; i < bars.length; i++) {
		think(bars[i], function(err, result) {
			console.log("callback in ohlcTrader", result)
		});
	}
	think("{data:end}", function(err, result) {
		callback(err, result);
	});

}
exports.getTrades = getTrades;

function think(data, callback) {

	if (!data) {
		console.log("Data contained no value:", data);
	}

	if (data === "{data:end}") {

		var result = [];

		for (var i in symbols) {
			if (symbols.hasOwnProperty(i)) {

				result[i] = {
					position: symbols[i].position,
					purchasePrice: symbols[i].openAt,
					purchaseTime: util.minuteNumToTime(symbols[i].openedAtMinuteNum),
					salePrice: symbols[i].closeAt,
					saleTime: util.minuteNumToTime(symbols[i].closedAtMinuteNum)

				}
				symbols[i].highs.length = 0;
				symbols[i].lows.length = 0;
				symbols[i].position = undefined;
				symbols[i].openAt = undefined;
				symbols[i].closeAt = undefined;
				symbols[i].hasOpened = false;
				symbols[i].openedAtMinuteNum = undefined;
				symbols[i].hasClosed = false;
				symbols[i].closedAtMinuteNum = undefined;

				var dollarsPerDay = util.money(symbols[i].profit/(symbols[i].numWins + symbols[i].numLosses))

				console.log("end", i, dollarsPerDay, util.money(symbols[i].profit), (symbols[i].numWins / (symbols[i].numWins + symbols[i].numLosses)));

			}
		}
		if (callback) {
			return callback(null, result);
		}
		return;
	}
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
			profit: 0,
			numWins: 0,
			numLosses: 0
		};

	}

	symbols[data.symbolName].highs.push(data.high);
	symbols[data.symbolName].lows.push(data.low);
	if (data.end) {
		return;
	}
	console.log("data:", data);
	if (!data.end
		&& data.dateTime.getHours() === 8
		&& data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes
		&&  data.dateTime.getHours() < 15) {

		if (data.dateTime.getHours() === 14
			&& data.dateTime.getMinutes() >= 55) {

			for (var i in symbols) {
				if (symbols.hasOwnProperty(i)
					&& symbols[i].hasOpened
					&& !symbols[i].hasClosed) {
					console.log("still holding.")
				process.exit();
				}
			}
		}

		var minuteNum = util.getMinuteNum(data.dateTime);
		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName].lows);
		var higherHighs = isHigherHighs(minuteNum, symbols[data.symbolName].highs);

		if (!symbols[data.symbolName].position) {
			if (!lowerLows && higherHighs) {
				symbols[data.symbolName].position = "LONG";
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].closeAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt - ((symbols[data.symbolName].closeAt - symbols[data.symbolName].openAt) * config.riskFactor);
				console.log("long on", data.symbolName)
			}

			else if (lowerLows && !higherHighs) {
				symbols[data.symbolName].position = "SHORT";
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].closeAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt + ((symbols[data.symbolName].closeAt - symbols[data.symbolName].openAt) * config.riskFactor);
				console.log("shorting", data.symbolName)
			}
		}
		else {

			if (!symbols[data.symbolName].hasClosed
				&& !symbols[data.symbolName].hasOpened
				&& symbols[data.symbolName].position === "LONG"
				&& data.low >= symbols[data.symbolName].openAt) {
					symbols[data.symbolName].hasOpened = true;

			}
			else if (!symbols[data.symbolName].hasClosed
				&& !symbols[data.symbolName].hasOpened
				&& symbols[data.symbolName].position === "SHORT"
				&& data.high <= symbols[data.symbolName].openAt) {
					symbols[data.symbolName].hasOpened = true;
			}
			// TODO: allow trader to buy and sell during same minute
			else if (symbols[data.symbolName].hasOpened
				&& !symbols[data.symbolName].hasClosed
				&& symbols[data.symbolName].position === "LONG") {
				if (data.low <= symbols[data.symbolName].stopLoss) {
					symbols[data.symbolName].hasClosed = true;
					symbols[data.symbolName].closedAtMinuteNum = minuteNum;
					symbols[data.symbolName].numLosses++;
					symbols[data.symbolName].stopLoss = symbols[data.symbolName].stopLoss < data.open ? symbols[data.symbolName].stopLoss : data.open;
					symbols[data.symbolName].profit += symbols[data.symbolName].stopLoss - symbols[data.symbolName].openAt;
				}
				else if (data.high >= symbols[data.symbolName].closeAt) {
					closeLongOrAdjustOrders(data.symbolName, data);
				}
			}
			else if (symbols[data.symbolName].hasOpened
				&& !symbols[data.symbolName].hasClosed
				&& symbols[data.symbolName].position === "SHORT") {

				if (data.high >= symbols[data.symbolName].stopLoss) {
					symbols[data.symbolName].hasClosed = true;
					symbols[data.symbolName].closedAtMinuteNum = minuteNum;
					symbols[data.symbolName].numLosses++;
					symbols[data.symbolName].stopLoss = symbols[data.symbolName].stopLoss > data.open ? symbols[data.symbolName].stopLoss : data.open;
					symbols[data.symbolName].profit += symbols[data.symbolName].openAt - symbols[data.symbolName].stopLoss;
				}
				else if (data.high <= symbols[data.symbolName].closeAt) {
					closeShortOrAdjustOrders(data.symbolName, data);
				}
			}
		}
	}
}

function closeLongOrAdjustOrders(symbolName, data) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[symbolName].highs);
	if (!lowerLows && higherHighs) {
		symbols[symbolName].closeAt = extendTrend(symbols[symbolName].highs);
		symbols[symbolName].stopLoss = symbols[symbolName].close - ((symbols[symbolName].closeAt - symbols[symbolName].close) * config.riskFactor);
	}
	else {
		symbols[symbolName].hasClosed = true;
		symbols[symbolName].closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;
		symbols[symbolName].closeAt = symbols[symbolName].closeAt > data.open ? symbols[symbolName].closeAt : data.open;
		symbols[symbolName].profit += symbols[symbolName].closeAt - symbols[symbolName].openAt;
	}
}

function closeShortOrAdjustOrders(symbolName, data) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[symbolName].highs);
	if (lowerLows && !higherHighs) {
		symbols[symbolName].closeAt = extendTrend(symbols[symbolName].lows);
		symbols[symbolName].stopLoss = symbols[symbolName].close + ((symbols[symbolName].closeAt - symbols[symbolName].close) * config.riskFactor);
	}
	else {
		symbols[symbolName].hasClosed = true;
		symbols[symbolName].closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;
		symbols[symbolName].closeAt = symbols[symbolName].closeAt < data.open ? symbols[symbolName].closeAt : data.open;
		symbols[symbolName].profit += symbols[symbolName].closeAt - symbols[symbolName].openAt;
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
	var next = arr[arr.length - 1] + ((arr[arr.length - 1] - arr[arr.length - 2]) * config.shyFactor);
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