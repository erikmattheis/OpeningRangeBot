"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

var config = {
	numOpeningMinutes: 2,
	riskFactor: .5,
	shyFactor: 1,
	thinkOutLoud: true
}

var emitter, broker, openingRange, symbols, previousMinuteData;

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
	previousMinuteData = [];

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
			console.log("callback in ohlcTrader", result);
			think("{data:end}", function(err, result) {
				callback(err, result);
			});
		});
	}
}
exports.getTrades = getTrades;

function think(data, callback) {

	if (!data) {
		console.log("Data contained no value:", data);
	}

	var todayString = getMostRecentMidnight(data.dateTime).toString();
	// TODO: Sending this wrong somewhere
	if (data === "{data:end}"
		|| data.end) {
		return endDay(callback);
	}

	previousMinuteData[data.symbolName] = data;

	if (!symbols[data.symbolName]) {
		symbols[data.symbolName] = {
			highs: [],
			lows: [],
			position: undefined,
			openAt: undefined,
			profitTarget: undefined,
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

	// TODO: should start entirely new symbol object each new day instead
	symbols[data.symbolName].date = data.dateTime;

	if ((data.dateTime.getHours() >= 8
		|| (data.dateTime.getHours() === 8 && data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes))
		&&  data.dateTime.getHours() < 15) {

		if (data.dateTime.getHours() === 14
			&& data.dateTime.getMinutes() >= 55) {
			util.thinkOutLoud("It's the last minutes of the trading day");
			for (var i in symbols) {
				if (symbols.hasOwnProperty(i)
					&& symbols[i].hasOpened
					&& !symbols[i].hasClosed) {
					util.thinkOutLoud("still holding " + i);
					closePosition(i, data)
				}
			}
		}

		var minuteNum = util.getMinuteNum(data.dateTime);
		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName].lows);
		var higherHighs = isHigherHighs(minuteNum, symbols[data.symbolName].highs);

		util.thinkOutLoud("Looking at minute number " + minuteNum);

		if (symbols[data.symbolName].position
			&& !symbols[data.symbolName].hasClosed
			&& !symbols[data.symbolName].hasOpened) {

			if (symbols[data.symbolName].position === "LONG"
				&& data.low <= symbols[data.symbolName].openAt) {

				symbols[data.symbolName].hasOpened = true;
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				util.thinkOutLoud("My order to go long triggered at minute " + minuteNum + " at " + symbols[data.symbolName].openAt);
			}
			else if (symbols[data.symbolName].position === "SHORT"
				&& data.high >= symbols[data.symbolName].openAt) {

				symbols[data.symbolName].hasOpened = true;
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				util.thinkOutLoud("My order to go short triggered at minute " + minuteNum + " at " + symbols[data.symbolName].openAt);
			}
			// TODO: allow trader to buy and sell during same minute
			else if (symbols[data.symbolName].hasOpened
				&& !symbols[data.symbolName].hasClosed
				&& symbols[data.symbolName].position === "LONG") {
				if (data.low <= symbols[data.symbolName].stopLoss) {
					symbols[data.symbolName].hasClosed = true;
					symbols[data.symbolName].closedAtMinuteNum = minuteNum;
					if (symbols[data.symbolName].stopLoss < symbols[data.symbolName].openAt) {
						symbols[data.symbolName].numLosses++;
					}
					else {
						symbols[data.symbolName].numWins++;
					}
					symbols[data.symbolName].salePrice = symbols[data.symbolName].stopLoss < data.open ? symbols[data.symbolName].stopLoss : data.open;
					symbols[data.symbolName].profit += symbols[data.symbolName].salePrice - symbols[data.symbolName].openAt;
					util.thinkOutLoud("closed position on stop loss");
				}
				else if (data.high >= symbols[data.symbolName].profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeLongOrAdjustOrders(data.symbolName, data);
				}
			}
			else if (symbols[data.symbolName].hasOpened
				&& !symbols[data.symbolName].hasClosed
				&& symbols[data.symbolName].position === "SHORT") {

				if (data.high >= symbols[data.symbolName].stopLoss) {
					symbols[data.symbolName].hasClosed = true;
					symbols[data.symbolName].closedAtMinuteNum = minuteNum;
					if (symbols[data.symbolName].stopLoss > symbols[data.symbolName].openAt) {
						symbols[data.symbolName].numLosses++;
					}
					else {
						symbols[data.symbolName].numWins++;
					}
					symbols[data.symbolName].salePrice = symbols[data.symbolName].stopLoss > data.open ? symbols[data.symbolName].stopLoss : data.open;
					symbols[data.symbolName].profit += symbols[data.symbolName].salePrice - symbols[data.symbolName].openAt;
					util.thinkOutLoud("closed position on stop loss");
				}
				else if (data.high <= symbols[data.symbolName].profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeShortOrAdjustOrders(data.symbolName, data);
				}
			}
		}
		if (!symbols[data.symbolName].hasOpened) {
			if (!lowerLows && higherHighs) {
				util.thinkOutLoud("this minute has higher low and higher high: " + minuteNum);
				symbols[data.symbolName].position = "LONG";
				
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].profitTarget = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt - ((symbols[data.symbolName].profitTarget - symbols[data.symbolName].openAt) * config.riskFactor);
				util.thinkOutLoud("I will go long on " + data.symbolName + " if I can buy during next minutes at: " + symbols[data.symbolName].openAt);
				util.thinkOutLoud("My target is: " + symbols[data.symbolName].profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbols[data.symbolName].stopLoss);
			}

			else if (lowerLows && !higherHighs) {
				util.thinkOutLoud("this minute has lower low and lower high: " + minuteNum);
				symbols[data.symbolName].position = "SHORT";
				
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].profitTarget = extendTrend(symbols[data.symbolName].lows);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt + ((symbols[data.symbolName].profitTarget - symbols[data.symbolName].openAt) * config.riskFactor);
				util.thinkOutLoud("I will go short " + data.symbolName + " if I can buy during next minutes at: " + symbols[data.symbolName].openAt);
				util.thinkOutLoud("My target is: " + symbols[data.symbolName].profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbols[data.symbolName].stopLoss);
			}

			else {
				symbols[data.symbolName].position = undefined;
			}
		}
	}
}

function closeLongOrAdjustOrders(symbolName, data, forceClose) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[symbolName].highs);
	if (!forceClose && !lowerLows && higherHighs) {
		symbols[symbolName].profitTarget = extendTrend(symbols[symbolName].highs);
		symbols[symbolName].stopLoss = data.close - ((symbols[symbolName].profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting long target to " + symbols[symbolName].profitTarget);
		util.thinkOutLoud("adjusting long stop loss to " + symbols[symbolName].stopLoss);
	}
	else {
		symbols[symbolName].hasClosed = true;
		symbols[symbolName].closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;
		symbols[data.symbolName].salePrice = symbols[symbolName].profitTarget > data.open ? symbols[symbolName].profitTarget : data.open;
		symbols[symbolName].profit += symbols[data.symbolName].salePrice - symbols[symbolName].openAt;

		util.thinkOutLoud("sold for profit of " + symbols[symbolName].profit);
	}
}

function closePosition(symbolName, data) {
	if (symbols[symbolName].position === "LONG") {
		closeLongOrAdjustOrders(symbolName, data, true)
	}
	else if (symbols[symbolName].position === "SHORT") {
		closeShortOrAdjustOrders(symbolName, data, true)
	}
}
function closeShortOrAdjustOrders(symbolName, data, forceClose) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[symbolName].highs);
	if (!forceClose && lowerLows && !higherHighs) {
		symbols[symbolName].profitTarget = extendTrend(symbols[symbolName].lows);
		symbols[symbolName].stopLoss = data.close + ((symbols[symbolName].profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting short target to " + symbols[symbolName].profitTarget);
		util.thinkOutLoud("adjusting short stop loss to " + symbols[symbolName].stopLoss);
	}
	else {
		symbols[symbolName].hasClosed = true;
		symbols[symbolName].closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;

		symbols[data.symbolName].salePrice = symbols[symbolName].profitTarget < data.open ? symbols[symbolName].profitTarget : data.open;
		symbols[symbolName].profit += symbols[data.symbolName].salePrice - symbols[symbolName].openAt;
		util.thinkOutLoud("sold for profit of " + symbols[symbolName].profit);

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

function endDay(callback) {
	util.thinkOutLoud("Day has ended");
		var result = [];

		for (var i in symbols) {
			if (symbols.hasOwnProperty(i)) {

				if (symbols[i].openedAtMinuteNum
					&& !symbols[i].closedAtMinuteNum) {
					closePosition(i, previousMinuteData[i], true);
				}
				result[i] = {
					position: symbols[i].position,
					purchasePrice: symbols[i].openAt,
					purchaseTime: util.minuteNumToTime(symbols[i].openedAtMinuteNum, symbols[i].date),
					salePrice: symbols[i].salePrice,
					saleTime: util.minuteNumToTime(symbols[i].closedAtMinuteNum, symbols[i].date)
				}
				symbols[i].highs.length = 0;
				symbols[i].lows.length = 0;
				symbols[i].position = undefined;
				symbols[i].openAt = undefined;
				symbols[i].profitTarget = undefined;
				symbols[i].hasOpened = false;
				symbols[i].openedAtMinuteNum = undefined;
				symbols[i].hasClosed = false;
				symbols[i].closedAtMinuteNum = undefined;

				var dollarsPerDay = util.money(symbols[i].profit/(symbols[i].numWins + symbols[i].numLosses))

				console.log(i,
					dollarsPerDay + " avg trade per day\n",
					util.money(symbols[i].profit) + " total profit\n",
					(symbols[i].numWins / (symbols[i].numWins + symbols[i].numLosses)) + " w/l\n\n");

			}
		}
		if (callback) {
			return callback(null, result);
		}
		return;
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