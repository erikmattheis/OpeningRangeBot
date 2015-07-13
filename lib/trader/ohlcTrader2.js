
"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

var config = {
	numOpeningMinutes: 1,
	riskFactor: .5,
	shyFactor: 1,
	requireDirectionCheck: true,
	thinkOutLoud: true,
	maxLoss: .1,
	useMaxLoss: true
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

function getResults()

function think(data, callback) {




	previousMinuteData[data.symbolName] = data;

	if (!symbols[data.symbolName]) {
		symbols[data.symbolName] = [];
		symbols[data.symbolName]["profit"] = 0;
		symbols[data.symbolName]["numWins"] = 0;
		symbols[data.symbolName]["numLosses"] = 0;
		symbols[data.symbolName]["largestWin"] = 0;
		symbols[data.symbolName]["largestLoss"] = 0;
		symbols[data.symbolName]["minuteTotals"] = [];
		symbols[data.symbolName]["balance"] = 1000;
	}
	if (!symbols[data.symbolName][todayString]) {
		symbols[data.symbolName][todayString] = {
			highs: [],
			lows: [],
			opens: [],
			closes: []
		};
	}

	var currentTrade = symbols[data.symbolName][todayString];
	currentTrade.symbolName = data.symbolName;

	if (cachedResults[todayString]) {
		return callback(null, cachedResults[todayString]);
	}
	if (currentTrade.closedAtMinuteNum) {
		return;
	}

	currentTrade.highs.push(data.high);
	currentTrade.lows.push(data.low);
	currentTrade.opens.push(data.open);
	currentTrade.closes.push(data.close);

	// TODO: should start entirely new symbol object each new day instead
	currentTrade.date = data.dateTime;


	if ((data.dateTime.getHours() > 8
		|| (data.dateTime.getHours() === 8 && data.dateTime.getMinutes() >= 29 + config.numOpeningMinutes))
		&&  data.dateTime.getHours() < 15) {

	if (data.dateTime.getHours() === 8 && data.dateTime.getMinutes() < 29 + config.numOpeningMinutes) {
		console.log("WTF")
		process.exit()
	}

		if (data.dateTime.getHours() === 14
			&& data.dateTime.getMinutes() >= 55) {

			if (callback) {
				callback();
			}
		}

		var minuteNum = util.getMinuteNum(data.dateTime);
		if (!symbols[data.symbolName]["minuteTotals"][minuteNum]) {
			symbols[data.symbolName]["minuteTotals"][minuteNum] = 0;
		}


		var lowerLows = isLowerLows(minuteNum, symbols[data.symbolName][todayString].lows);
		var higherHighs = isHigherHighs(minuteNum, symbols[data.symbolName][todayString].highs);

		if (currentTrade.position
			&& !currentTrade.openedAtMinuteNum) {
			if (currentTrade.position === "LONG"
				&& data.low <= currentTrade.openAt) {

				currentTrade.openedAtMinuteNum = minuteNum;
				currentTrade.purchasePrice = data.open < currentTrade.openAt ? data.open : currentTrade.openAt;
				if (config.useMaxLoss) {
					currentTrade.stopLoss = (currentTrade.purchasePrice - currentTrade.stopLoss) > config.maxLoss ? currentTrade.purchasePrice - config.maxLoss : currentTrade.stopLoss;
				}
				util.thinkOutLoud("My order to go long triggered at minute " + minuteNum + " at " + currentTrade.purchasePrice + " - low was " + data.low);
			}
			else if (currentTrade.position === "SHORT"
				&& data.high >= currentTrade.openAt) {

				currentTrade.openedAtMinuteNum = minuteNum;
				currentTrade.purchasePrice = data.open > currentTrade.openAt ? data.open : currentTrade.openAt;
				if (config.useMaxLoss) {
					currentTrade.stopLoss = (currentTrade.stopLoss - currentTrade.purchasePrice) > config.maxLoss ? currentTrade.purchasePrice + config.maxLoss : currentTrade.stopLoss;
				}
				util.thinkOutLoud("My order to go short triggered at minute " + minuteNum + " at " + currentTrade.purchasePrice);
			}

		}
		
		else if (currentTrade.openedAtMinuteNum
			&& !currentTrade.closedAtMinuteNum) {
			console.log("looking to sell or adjust")
			if (currentTrade.position === "LONG") {
				console.log(data.low + " <= " + currentTrade.stopLoss)
				if (data.low <= currentTrade.stopLoss) {
					currentTrade.closedAtMinuteNum = minuteNum;

					currentTrade.salePrice = currentTrade.stopLoss < data.open ? currentTrade.stopLoss : data.open;
					currentTrade.profit = currentTrade.salePrice - currentTrade.purchasePrice;
					symbols[data.symbolName].profit += currentTrade.profit;
					util.thinkOutLoud("closed position on stop loss at minute " + minuteNum);
					if (currentTrade.stopLoss < currentTrade.purchasePrice) {
						symbols[data.symbolName].numLosses++;
					}
					else {
						symbols[data.symbolName].numWins++;
					}
					symbols[data.symbolName]["minuteTotals"][currentTrade.openedAtMinuteNum] += currentTrade.profit;
					adjustBalance(currentTrade);
				}
				else if (data.high >= currentTrade.profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeLongOrAdjustOrders(data.symbolName, data);
				}
			}
			else if (currentTrade.position === "SHORT") {
				console.log(data.high + " >= " + currentTrade.stopLoss)
				if (data.high >= currentTrade.stopLoss) {
					currentTrade.closedAtMinuteNum = minuteNum;
					currentTrade.salePrice = currentTrade.stopLoss > data.open ? currentTrade.stopLoss : data.open;
					currentTrade.profit = currentTrade.purchasePrice - currentTrade.salePrice;
					symbols[data.symbolName].profit += currentTrade.profit;
					util.thinkOutLoud("closed position on stop loss at minute " + minuteNum);
					if (currentTrade.stopLoss > currentTrade.purchasePrice) {
						symbols[data.symbolName].numLosses++;
					}
					else {
						symbols[data.symbolName].numWins++;
					}
					symbols[data.symbolName]["minuteTotals"][currentTrade.openedAtMinuteNum] += currentTrade.profit;
					adjustBalance(currentTrade);
				}
				else if (data.high <= currentTrade.profitTarget) {
					util.thinkOutLoud("closing or adjusting");
					closeShortOrAdjustOrders(data.symbolName, data);
				}
			}
		}

		if (!currentTrade.openedAtMinuteNum) {
			if (!lowerLows && higherHighs
				&& (data.close > data.open
					|| !config.requireDirectionCheck)) {
				util.thinkOutLoud("this minute has higher low and higher high: " + minuteNum);
				util.thinkOutLoud("the low was: " + data.low);
				util.thinkOutLoud("the high was: " + data.high);
				currentTrade.position = "SHORT";
				
				currentTrade.openAt = extendTrend(currentTrade.lows);
				
				currentTrade.profitTarget = extendTrend(currentTrade.highs);
				var projectedGain = (currentTrade.profitTarget - currentTrade.openAt);
				currentTrade.stopLoss = currentTrade.openAt - (projectedGain * config.riskFactor);
				util.thinkOutLoud("I will go long on " + data.symbolName + " if I can buy during next minutes at: " + currentTrade.openAt);
				util.thinkOutLoud("My target is: " + currentTrade.profitTarget);
				util.thinkOutLoud("My stop loss is: " + currentTrade.stopLoss);
			}

			else if (lowerLows && !higherHighs
				&& (data.close < data.open
					|| !config.requireDirectionCheck)) {
				util.thinkOutLoud("this minute has lower low and lower high: " + minuteNum);
				currentTrade.position = "SHORT";
				
				currentTrade.openAt = extendTrend(currentTrade.highs);
				currentTrade.profitTarget = extendTrend(currentTrade.lows);
				var projectedGain = (currentTrade.openAt - currentTrade.profitTarget);
				currentTrade.stopLoss = currentTrade.openAt + (projectedGain * config.riskFactor);
				util.thinkOutLoud("I will go short " + data.symbolName + " if I can buy during next minutes at: " + currentTrade.openAt);
				util.thinkOutLoud("My target is: " + currentTrade.profitTarget);
				util.thinkOutLoud("My stop loss is: " + currentTrade.stopLoss);
			}

			else {
				currentTrade.position = undefined;
				console.log("don't buy anything")
			}
		}
		symbols[data.symbolName].largestWin = currentTrade.profit > symbols[data.symbolName].largestWin ? currentTrade.profit : symbols[data.symbolName].largestWin;
		symbols[data.symbolName].largestLoss = currentTrade.profit < symbols[data.symbolName].largestLoss ? currentTrade.profit : symbols[data.symbolName].largestLoss;
	}
}


function closePosition(symbolName, data) {
	var currentTrade = symbols[symbolName][data.todayString];
	if (currentTrade.position === "LONG") {
		closeLongOrAdjustOrders(symbolName, data, true)
	}
	else if (currentTrade.position === "SHORT") {
		closeShortOrAdjustOrders(symbolName, data, true)
	}
}

function closeLongOrAdjustOrders(symbolName, data, forceClose) {
	var currentTrade = symbols[symbolName][data.todayString];
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, currentTrade.lows);
	var higherHighs = isHigherHighs(minuteNum, currentTrade.highs);
	if (!forceClose && !lowerLows && higherHighs) {
		currentTrade.profitTarget = extendTrend(currentTrade.highs);
		var newStopLoss = data.close - ((currentTrade.profitTarget - data.close) * config.riskFactor);
		currentTrade.stopLoss = newStopLoss > currentTrade.stopLoss ? newStopLoss : currentTrade.stopLoss;
		util.thinkOutLoud("adjusting long target to " + currentTrade.profitTarget);
		util.thinkOutLoud("adjusting long stop loss to " + currentTrade.stopLoss);
	}
	else {
		currentTrade.closedAtMinuteNum = minuteNum;
		symbols[symbolName].numWins++;
		currentTrade.salePrice = currentTrade.profitTarget > data.open ? currentTrade.profitTarget : data.open;
		currentTrade.profit = currentTrade.salePrice - currentTrade.purchasePrice;
		symbols[data.symbolName].profit += currentTrade.profit;
		util.thinkOutLoud("sold for profit of " + currentTrade.profit);
		symbols[data.symbolName]["minuteTotals"][currentTrade.openedAtMinuteNum] += currentTrade.profit;
		adjustBalance(currentTrade);
	}
}

function closeShortOrAdjustOrders(symbolName, data, forceClose) {
	var currentTrade = symbols[symbolName][data.todayString];
	var minuteNum = util.getMinuteNum(data.dateTime);
	var lowerLows = isLowerLows(minuteNum, currentTrade.lows);
	var higherHighs = isHigherHighs(minuteNum, currentTrade.highs);
	if (!forceClose && lowerLows && !higherHighs) {
		currentTrade.profitTarget = extendTrend(currentTrade.lows);
		var newStopLoss = data.close + ((currentTrade.profitTarget - data.close) * config.riskFactor);
		currentTrade.stopLoss = newStopLoss < currentTrade.stopLoss ? newStopLoss : currentTrade.stopLoss;
		util.thinkOutLoud("adjusting short target to " + currentTrade.profitTarget);
		util.thinkOutLoud("adjusting short stop loss to " + currentTrade.stopLoss);
	}
	else {
		currentTrade.closedAtMinuteNum = minuteNum;
		symbols[data.symbolName].numWins++;
		currentTrade.salePrice = currentTrade.profitTarget < data.open ? currentTrade.profitTarget : data.open;
		currentTrade.profit = currentTrade.purchasePrice - currentTrade.salePrice;
		symbols[data.symbolName].profit += currentTrade.profit;
		util.thinkOutLoud("sold for profit of " + currentTrade.profit);
		symbols[data.symbolName]["minuteTotals"][currentTrade.openedAtMinuteNum] += currentTrade.profit;
		adjustBalance(currentTrade);
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

function extendTrend(arr, trendLength) {
	trendLength = trendLength === undefined ? 2 : trendLength;
	if (arr.length < trendLength) {
		throw new Error("Trend length is shorter than array");
	}

	var nextFromSimpleMovingAverage = arr.slice(-trendLength).reduceRight(function(a, b) {
	  return a + b;
	}) / trendLength;
	return util.money(nextFromSimpleMovingAverage);
}

function getMinuteHeight(bar) {
	return util.money(Math.abs(bar.high - bar.low));
}

function adjustBalance(currentTrade) {


}

function endDay(todayString) {


}