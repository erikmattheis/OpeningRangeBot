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

var emitter, broker, openingRange, symbols, previousMinuteData, cachedResults;

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
	cachedResults = [];

}

exports.Trader = Trader;

function checkConfig() {
	if (config.numOpeningMinutes < 1) {
		throw new Error("numOpeningMinutes must be greater than zero.")
	}
}

function getTrades(bars, callback) {
	var returned;
	for (var i = 0; i < bars.length && !returned; i++) {
		think(bars[i], function(err, result) {
			console.log("callback in ohlcTrader", result);
			if (result && result.isCached) {
				returned = true;
				return callback(err, result);
			}
			think("{data:end}", function(err, result) {
				returned = true;
				return callback(err, result);
			});
		});
	}
}
exports.getTrades = getTrades;

function think(data, callback) {

	if (!data) {
		return console.log("Data contained no value:", data);
	}

	var todayString = data.dateTime ? util.getMostRecentMidnight(data.dateTime).toString() : "end";

	if (cachedResults[todayString]) {
		return callback(null, cachedResults[todayString]);
	}

	data.todayString = todayString;

	// TODO: Sending this wrong somewhere
	if (data === "{data:end}"
		|| data.end) {
		return endDay(previousMinuteData["IWM"].todayString, callback);
	}

	previousMinuteData[data.symbolName] = data;

	if (!symbols[todayString]) {
		symbols[todayString] = [];
	}

	if (!symbols[todayString][data.symbolName]) {
		symbols[todayString][data.symbolName] = {
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

	symbols[todayString][data.symbolName].highs.push(data.high);
	symbols[todayString][data.symbolName].lows.push(data.low);

	// TODO: should start entirely new symbol object each new day instead
	symbols[todayString][data.symbolName].date = data.dateTime;

	if ((data.dateTime.getHours() >= 8
		|| (data.dateTime.getHours() === 8 && data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes))
		&&  data.dateTime.getHours() < 15) {

		if (data.dateTime.getHours() === 14
			&& data.dateTime.getMinutes() >= 55) {
			util.thinkOutLoud("It's the last minutes of the trading day");
			callback();
		}

		var minuteNum = util.getMinuteNum(data.dateTime);
		var lowerLows = isLowerLows(minuteNum, symbols[todayString][data.symbolName].lows);
		var higherHighs = isHigherHighs(minuteNum, symbols[todayString][data.symbolName].highs);

		util.thinkOutLoud("Looking at minute number " + minuteNum);

		if (symbols[todayString][data.symbolName].position
			&& !symbols[todayString][data.symbolName].hasClosed
			&& !symbols[todayString][data.symbolName].hasOpened) {

			if (symbols[todayString][data.symbolName].position === "LONG"
				&& data.low <= symbols[todayString][data.symbolName].openAt) {

				symbols[todayString][data.symbolName].hasOpened = true;
				symbols[todayString][data.symbolName].openedAtMinuteNum = minuteNum;
				util.thinkOutLoud("My order to go long triggered at minute " + minuteNum + " at " + symbols[todayString][data.symbolName].openAt);
			}
			else if (symbols[todayString][data.symbolName].position === "SHORT"
				&& data.high >= symbols[todayString][data.symbolName].openAt) {

				symbols[todayString][data.symbolName].hasOpened = true;
				symbols[todayString][data.symbolName].openedAtMinuteNum = minuteNum;
				util.thinkOutLoud("My order to go short triggered at minute " + minuteNum + " at " + symbols[todayString][data.symbolName].openAt);
			}
			// TODO: allow trader to buy and sell during same minute
			else if (symbols[todayString][data.symbolName].hasOpened
				&& !symbols[todayString][data.symbolName].hasClosed
				&& symbols[todayString][data.symbolName].position === "LONG") {
				if (data.low <= symbols[todayString][data.symbolName].stopLoss) {
					symbols[todayString][data.symbolName].hasClosed = true;
					symbols[todayString][data.symbolName].closedAtMinuteNum = minuteNum;
					if (symbols[todayString][data.symbolName].stopLoss < symbols[todayString][data.symbolName].openAt) {
						symbols[todayString][data.symbolName].numLosses++;
					}
					else {
						symbols[todayString][data.symbolName].numWins++;
					}
					symbols[todayString][data.symbolName].salePrice = symbols[todayString][data.symbolName].stopLoss < data.open ? symbols[todayString][data.symbolName].stopLoss : data.open;
					symbols[todayString][data.symbolName].profit += symbols[todayString][data.symbolName].salePrice - symbols[todayString][data.symbolName].openAt;
					util.thinkOutLoud("closed position on stop loss");
				}
				else if (data.high >= symbols[todayString][data.symbolName].profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeLongOrAdjustOrders(data.symbolName, data);
				}
			}
			else if (symbols[todayString][data.symbolName].hasOpened
				&& !symbols[todayString][data.symbolName].hasClosed
				&& symbols[todayString][data.symbolName].position === "SHORT") {

				if (data.high >= symbols[todayString][data.symbolName].stopLoss) {
					symbols[todayString][data.symbolName].hasClosed = true;
					symbols[todayString][data.symbolName].closedAtMinuteNum = minuteNum;
					if (symbols[todayString][data.symbolName].stopLoss > symbols[todayString][data.symbolName].openAt) {
						symbols[todayString][data.symbolName].numLosses++;
					}
					else {
						symbols[todayString][data.symbolName].numWins++;
					}
					symbols[todayString][data.symbolName].salePrice = symbols[todayString][data.symbolName].stopLoss > data.open ? symbols[todayString][data.symbolName].stopLoss : data.open;
					symbols[todayString][data.symbolName].profit += symbols[todayString][data.symbolName].salePrice - symbols[todayString][data.symbolName].openAt;
					util.thinkOutLoud("closed position on stop loss");
				}
				else if (data.high <= symbols[todayString][data.symbolName].profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeShortOrAdjustOrders(data.symbolName, data);
				}
			}
		}
		if (!symbols[todayString][data.symbolName].hasOpened) {
			if (!lowerLows && higherHighs) {
				util.thinkOutLoud("this minute has higher low and higher high: " + minuteNum);
				symbols[todayString][data.symbolName].position = "LONG";
				
				symbols[todayString][data.symbolName].openAt = extendTrend(symbols[todayString][data.symbolName].lows);
				symbols[todayString][data.symbolName].profitTarget = extendTrend(symbols[todayString][data.symbolName].highs);
				symbols[todayString][data.symbolName].stopLoss = symbols[todayString][data.symbolName].openAt - ((symbols[todayString][data.symbolName].profitTarget - symbols[todayString][data.symbolName].openAt) * config.riskFactor);
				util.thinkOutLoud("I will go long on " + data.symbolName + " if I can buy during next minutes at: " + symbols[todayString][data.symbolName].openAt);
				util.thinkOutLoud("My target is: " + symbols[todayString][data.symbolName].profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbols[todayString][data.symbolName].stopLoss);
			}

			else if (lowerLows && !higherHighs) {
				util.thinkOutLoud("this minute has lower low and lower high: " + minuteNum);
				symbols[todayString][data.symbolName].position = "SHORT";
				
				symbols[todayString][data.symbolName].openAt = extendTrend(symbols[todayString][data.symbolName].highs);
				symbols[todayString][data.symbolName].profitTarget = extendTrend(symbols[todayString][data.symbolName].lows);
				symbols[todayString][data.symbolName].stopLoss = symbols[todayString][data.symbolName].openAt + ((symbols[todayString][data.symbolName].profitTarget - symbols[todayString][data.symbolName].openAt) * config.riskFactor);
				util.thinkOutLoud("I will go short " + data.symbolName + " if I can buy during next minutes at: " + symbols[todayString][data.symbolName].openAt);
				util.thinkOutLoud("My target is: " + symbols[todayString][data.symbolName].profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbols[todayString][data.symbolName].stopLoss);
			}

			else {
				symbols[todayString][data.symbolName].position = undefined;
			}
		}
	}
}

function closeLongOrAdjustOrders(symbolName, data, forceClose) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[data.todayString][symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[data.todayString][symbolName].highs);
	if (!forceClose && !lowerLows && higherHighs) {
		symbols[data.todayString][symbolName].profitTarget = extendTrend(symbols[data.todayString][symbolName].highs);
		symbols[data.todayString][symbolName].stopLoss = data.close - ((symbols[data.todayString][symbolName].profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting long target to " + symbols[data.todayString][symbolName].profitTarget);
		util.thinkOutLoud("adjusting long stop loss to " + symbols[data.todayString][symbolName].stopLoss);
	}
	else {
		symbols[data.todayString][symbolName].hasClosed = true;
		symbols[data.todayString][symbolName].closedAtMinuteNum = minuteNum;
		symbols[data.todayString][symbolName].numWins++;
		symbols[data.todayString][data.symbolName].salePrice = symbols[data.todayString][symbolName].profitTarget > data.open ? symbols[data.todayString][symbolName].profitTarget : data.open;
		symbols[data.todayString][symbolName].profit += symbols[data.todayString][data.symbolName].salePrice - symbols[data.todayString][symbolName].openAt;

		util.thinkOutLoud("sold for profit of " + symbols[data.todayString][symbolName].profit);
	}
}

function closePosition(symbolName, data) {
	if (symbols[data.todayString][symbolName].position === "LONG") {
		closeLongOrAdjustOrders(symbolName, data, true)
	}
	else if (symbols[data.todayString][symbolName].position === "SHORT") {
		closeShortOrAdjustOrders(symbolName, data, true)
	}
	for (var i in symbols[data.todayString]) {
		if (symbols[data.todayString].hasOwnProperty(i)
			&& symbols[data.todayString][i].openedAtMinuteNum
			&& !symbols[data.todayString][i].closedAtMinuteNum) {
			util.thinkOutLoud("still holding " + i);
			closePosition(i, data)
		}
	}
}

function closeShortOrAdjustOrders(symbolName, data, forceClose) {
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbols[data.todayString][symbolName].lows);
	var higherHighs = isHigherHighs(minuteNum, symbols[data.todayString][symbolName].highs);
	if (!forceClose && lowerLows && !higherHighs) {
		symbols[data.todayString][symbolName].profitTarget = extendTrend(symbols[data.todayString][symbolName].lows);
		symbols[data.todayString][symbolName].stopLoss = data.close + ((symbols[data.todayString][symbolName].profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting short target to " + symbols[data.todayString][symbolName].profitTarget);
		util.thinkOutLoud("adjusting short stop loss to " + symbols[data.todayString][symbolName].stopLoss);
	}
	else {
		symbols[data.todayString][symbolName].hasClosed = true;
		symbols[data.todayString][symbolName].closedAtMinuteNum = minuteNum;
		symbols[data.todayString][symbolName].numWins++;

		symbols[data.todayString][data.symbolName].salePrice = symbols[data.todayString][symbolName].profitTarget < data.open ? symbols[data.todayString][symbolName].profitTarget : data.open;
		symbols[data.todayString][symbolName].profit += symbols[data.todayString][data.symbolName].salePrice - symbols[data.todayString][symbolName].openAt;
		util.thinkOutLoud("sold for profit of " + symbols[data.todayString][symbolName].profit);

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

function endDay(todayString, callback) {
	util.thinkOutLoud("Day has ended");
		var result = [];

		for (var i in symbols[todayString]) {
			if (symbols[todayString].hasOwnProperty(i)) {

				if (symbols[todayString][i].openedAtMinuteNum
					&& !symbols[todayString][i].closedAtMinuteNum) {
					closePosition(i, previousMinuteData[i], true);
				}
				result[i] = {
					position: symbols[todayString][i].position,
					purchasePrice: symbols[todayString][i].openAt,
					purchaseTime: util.minuteNumToTime(symbols[todayString][i].openedAtMinuteNum, symbols[todayString][i].date),
					salePrice: symbols[todayString][i].salePrice,
					saleTime: util.minuteNumToTime(symbols[todayString][i].closedAtMinuteNum, symbols[todayString][i].date)
				}

				var dollarsPerDay = util.money(symbols[todayString][i].profit/(symbols[todayString][i].numWins + symbols[todayString][i].numLosses))

				console.log(i,
					dollarsPerDay + " avg trade per day\n",
					util.money(symbols[todayString][i].profit) + " total profit\n",
					(symbols[todayString][i].numWins / (symbols[todayString][i].numWins + symbols[todayString][i].numLosses)) + " w/l\n\n");

			}
		}
		result.isCached = true;
		cachedResults[todayString] = result;
		if (callback) {
			return callback(null, result);
		}
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