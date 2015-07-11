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

var emitter, broker, openingRange, symbols, previousMinuteData, previousTodayString, cachedResults;

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

	var todayString = data.dateTime ? util.getMostRecentMidnight(data.dateTime).toString() : previousTodayString;

	data.todayString = previousTodayString = todayString;

	// TODO: Sending this wrong somewhere
	if (data === "{data:end}"
		|| data.end) {
		return endDay(todayString, callback);
	}

	previousMinuteData[data.symbolName] = data;

	if (!symbols[data.symbolName]) {
		symbols[data.symbolName] = [];
		symbols[data.symbolName]["profit"] = 0;
		symbols[data.symbolName]["numWins"] = 0;
		symbols[data.symbolName]["numLosses"] = 0;
	}
	if (!symbols[data.symbolName][todayString]) {
		symbols[data.symbolName][todayString] = {
			highs: [],
			lows: []
		};
	}

	var symbolToday = symbols[data.symbolName][todayString];

	symbolToday.highs.push(data.high);
	symbolToday.lows.push(data.low);

	// TODO: should start entirely new symbol object each new day instead
	symbolToday.date = data.dateTime;

	if ((data.dateTime.getHours() >= 8
		|| (data.dateTime.getHours() === 8 && data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes))
		&&  data.dateTime.getHours() < 15) {

		if (data.dateTime.getHours() === 14
			&& data.dateTime.getMinutes() >= 55) {
			util.thinkOutLoud("It's the last minutes of the trading day");

			if (callback) {
				callback();
			}
		}

		var minuteNum = util.getMinuteNum(data.dateTime);
		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName][todayString].lows);
		var higherHighs = isHigherHighs(minuteNum, symbols[data.symbolName][todayString].highs);

		util.thinkOutLoud("Looking at minute number " + minuteNum);


		// Did we buy anything?
		if (symbolToday.position
			&& !symbolToday.hasClosed
			&& !symbolToday.hasOpened) {

			if (symbolToday.position === "LONG"
				&& data.low <= symbolToday.openAt) {

				symbolToday.hasOpened = true;
				symbolToday.openedAtMinuteNum = minuteNum;
				symbolToday.purchasePrice = data.open < symbolToday.openAt ? data.open : symbolToday.openAt;
				util.thinkOutLoud("My order to go long triggered at minute " + minuteNum + " at " + symbolToday.purchasePrice + " - low was " + data.low);
			}
			else if (symbolToday.position === "SHORT"
				&& data.high >= symbolToday.openAt) {

				symbolToday.hasOpened = true;
				symbolToday.openedAtMinuteNum = minuteNum;
				symbolToday.purchasePrice = data.open > symbolToday.openAt ? data.open : symbolToday.openAt;
				util.thinkOutLoud("My order to go short triggered at minute " + minuteNum + " at " + symbolToday.purchasePrice);
			}
		}
		
		// TODO: allow trader to buy and sell during same minute
		else if (symbolToday.hasOpened
			&& !symbolToday.hasClosed
			&& symbolToday.position === "LONG") {
			if (data.low <= symbolToday.stopLoss) {
				symbolToday.hasClosed = true;
				symbolToday.closedAtMinuteNum = minuteNum;
				if (symbolToday.stopLoss < symbolToday.openAt) {
					symbols[data.symbolName].numLosses++;
				}
				else {
					symbols[data.symbolName].numWins++;
				}
				symbolToday.salePrice = symbolToday.stopLoss < data.open ? symbolToday.stopLoss : data.open;
				symbolToday.profit = symbolToday.salePrice - symbolToday.purchasePrice;
				symbols[data.symbolName].profit += symbolToday.profit;
				util.thinkOutLoud("closed position on stop loss");
			}
			else if (data.high >= symbolToday.profitTarget) {
				util.thinkOutLoud("closing or adjusting");
				closeLongOrAdjustOrders(data.symbolName, data);
			}
		}
		else if (symbolToday.hasOpened
			&& !symbolToday.hasClosed
			&& symbolToday.position === "SHORT") {

			if (data.high >= symbolToday.stopLoss) {
				symbolToday.hasClosed = true;
				symbolToday.closedAtMinuteNum = minuteNum;
				if (symbolToday.stopLoss > symbolToday.openAt) {
					symbols[data.symbolName].numLosses++;
				}
				else {
					symbols[data.symbolName].numWins++;
				}
				symbolToday.salePrice = symbolToday.stopLoss > data.open ? symbolToday.stopLoss : data.open;
				symbolToday.profit = symbolToday.salePrice - symbolToday.purchasePrice;
				symbols[data.symbolName].profit += symbolToday.profit;
				util.thinkOutLoud("closed position on stop loss");
			}
			else if (data.high <= symbolToday.profitTarget) {
				util.thinkOutLoud("closing or adjusting");
				closeShortOrAdjustOrders(data.symbolName, data);
			}
		}

		if (!symbolToday.hasOpened) {
			if (!lowerLows && higherHighs) {
				util.thinkOutLoud("this minute has higher low and higher high: " + minuteNum);
				util.thinkOutLoud("the low was: " + data.low);
				util.thinkOutLoud("the high was: " + data.high);
				symbolToday.position = "LONG";
				
				symbolToday.openAt = extendTrend(symbolToday.lows);
				util.thinkOutLoud("projecting next minute's low to be: " + symbolToday.openAt);
				
				symbolToday.profitTarget = extendTrend(symbolToday.highs);
				symbolToday.stopLoss = symbolToday.openAt - ((symbolToday.profitTarget - symbolToday.openAt) * config.riskFactor);
				util.thinkOutLoud("I will go long on " + data.symbolName + " if I can buy during next minutes at: " + symbolToday.openAt);
				util.thinkOutLoud("My target is: " + symbolToday.profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbolToday.stopLoss);
			}

			else if (lowerLows && !higherHighs) {
				util.thinkOutLoud("this minute has lower low and lower high: " + minuteNum);
				symbolToday.position = "SHORT";
				
				symbolToday.openAt = extendTrend(symbolToday.highs);
				symbolToday.profitTarget = extendTrend(symbolToday.lows);
				symbolToday.stopLoss = symbolToday.openAt + ((symbolToday.profitTarget - symbolToday.openAt) * config.riskFactor);
				util.thinkOutLoud("I will go short " + data.symbolName + " if I can buy during next minutes at: " + symbolToday.openAt);
				util.thinkOutLoud("My target is: " + symbolToday.profitTarget);
				util.thinkOutLoud("My stop loss is: " + symbolToday.stopLoss);
			}

			else {
				symbolToday.position = undefined;
			}
		}
	}
}

function closeLongOrAdjustOrders(symbolName, data, forceClose) {
	var symbolToday = symbols[symbolName][data.todayString];
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbolToday.lows);
	var higherHighs = isHigherHighs(minuteNum, symbolToday.highs);
	if (!forceClose && !lowerLows && higherHighs) {
		symbolToday.profitTarget = extendTrend(symbolToday.highs);
		symbolToday.stopLoss = data.close - ((symbolToday.profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting long target to " + symbolToday.profitTarget);
		util.thinkOutLoud("adjusting long stop loss to " + symbolToday.stopLoss);
	}
	else {
		symbolToday.hasClosed = true;
		symbolToday.closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;
		symbolToday.salePrice = symbolToday.profitTarget > data.open ? symbolToday.profitTarget : data.open;
		symbolToday.profit = symbolToday.salePrice - symbolToday.purchasePrice;
		symbols[data.symbolName].profit += symbolToday.profit;
		util.thinkOutLoud("sold for profit of " + symbolToday.profit);
	}
}

function closePosition(symbolName, data) {
	var symbolToday = symbols[symbolName][data.todayString];
	if (symbolToday.position === "LONG") {
		closeLongOrAdjustOrders(symbolName, data, true)
	}
	else if (symbolToday.position === "SHORT") {
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
	var symbolToday = symbols[symbolName][data.todayString];
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, symbolToday.lows);
	var higherHighs = isHigherHighs(minuteNum, symbolToday.highs);
	if (!forceClose && lowerLows && !higherHighs) {
		symbolToday.profitTarget = extendTrend(symbolToday.lows);
		symbolToday.stopLoss = data.close + ((symbolToday.profitTarget - data.close) * config.riskFactor);
		util.thinkOutLoud("adjusting short target to " + symbolToday.profitTarget);
		util.thinkOutLoud("adjusting short stop loss to " + symbolToday.stopLoss);
	}
	else {
		symbolToday.hasClosed = true;
		symbolToday.closedAtMinuteNum = minuteNum;
		symbols[data.symbolName].numWins++;

		symbolToday.salePrice = symbolToday.profitTarget < data.open ? symbolToday.profitTarget : data.open;
		symbolToday.profit = symbolToday.salePrice - symbolToday.purchasePrice;
		symbols[data.symbolName].profit += symbolToday.profit;
		util.thinkOutLoud("sold for profit of " + symbolToday.profit);

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
	util.thinkOutLoud(arr[arr.length - 1] + " + ((" + arr[arr.length - 1] + " - " + arr[arr.length - 2] + ") * " + config.shyFactor + ")");
	return util.money(next);
}

//console.log('extend:', extendTrend([1,2.5]))

function getMinuteHeight(bar) {
	return util.money(Math.abs(bar.high - bar.low));
}

function endDay(todayString, callback) {
	util.thinkOutLoud("Day has ended");
		var result = [];

		for (var i in symbols) {
			
			if (symbols.hasOwnProperty(i)
				&& symbols[i][todayString]
				&& symbols[i][todayString].openedAtMinuteNum) {

				if (symbols[i][todayString].openedAtMinuteNum
					&& !symbols[i][todayString].closedAtMinuteNum) {
					closePosition(i, previousMinuteData[i], true);
				}
				result[i] = {
					position: symbols[i][todayString].position,
					purchasePrice: symbols[i][todayString].purchasePrice,
					purchaseTime: util.minuteNumToTime(symbols[i][todayString].openedAtMinuteNum, symbols[i][todayString].date),
					salePrice: symbols[i][todayString].salePrice,
					saleTime: util.minuteNumToTime(symbols[i][todayString].closedAtMinuteNum, symbols[i][todayString].date)
				}
console.log(symbols[i].profit + "/ (" + symbols[i].numWins + " + " + symbols[i].numLosses + ")")
				var dollarsPerDay = util.money(symbols[i].profit/(symbols[i].numWins + symbols[i].numLosses))

				console.log(i,
					dollarsPerDay + " avg trade per day\n",
					util.money(symbols[i].profit) + " total profit\n",
					(symbols[i].numWins / (symbols[i].numWins + symbols[i].numLosses)) + " w/l\n\n");

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