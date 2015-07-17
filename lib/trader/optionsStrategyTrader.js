// simulation completed in 52.89 seconds

"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js'),
	db = require("../io/mongo/db.js"),
	async = require("async");

var emitter, broker, openingRange, symbols, previousMinuteData, previousTodayString, cachedResults;

var numWins = 0;
var numLosses = 0;
var totalProfit = 0;
var numDaysWithoutData = 0;
var lastProfit;
var maxIntradayDrawdown = 0;
var maxIntradayProfit = 0;


var config = {
	stopLossFraction: -0.0002,
	profitTargetFraction: 0.0002,
	buyAtMinute: 0,
	adjustProfitTarget: false
}

function start() {
	capital = 1000;
	var minute = 0;
	simulateScenarios(minute);
}
exports.start = start;

var targetGranularity = 0.0001;
var smallestAbsoluteFraction = 0.0002;
var largestAbsoluteFraction = 0.0015;
var numMinutes = 10;
var endSimulationOn = new Date(2015, 5, 1);
//var endSimulationOn = new Date(2015, 1, 5);


var steps = (largestAbsoluteFraction - smallestAbsoluteFraction) / targetGranularity;

console.log(steps * steps * numMinutes)
//process.exit()

function simulateScenarios(minute) {

	if (config.stopLossFraction < -largestAbsoluteFraction) {
		return console.log("simulation all done in", util.money((new Date().getTime() - timeStarted.getTime())/1000), "seconds");
		process.exit();
	}
	else if (config.profitTargetFraction > largestAbsoluteFraction) {
		config.stopLossFraction -= targetGranularity;
		config.profitTargetFraction = 0;
	}
	else if (config.buyAtMinute > numMinutes) {
		config.buyAtMinute = 0;
		config.profitTargetFraction += targetGranularity;
	}
	
	simulateDates(new Date(2015, 1, 3), endSimulationOn, function(err) {
				var logStr = "<tr>"
			+ "<td>" + capital + "</td>"
			+ "<td>" + maxDailyDrawdown + "</td>"
			+ "<td>" + maxDailyProfit + "</td>"
			+ "<td>" + util.money(maxIntradayDrawdown) + "</td>"
			+ "<td>" + util.money(maxIntradayProfit) + "</td>"
			+ "<td>" + util.money(numWins/(numWins + numLosses)) + "</td>"
			+ "<td>" + config.buyAtMinute + "</td>"
			+ "<td>" + config.stopLossFraction + "</td>"
			+ "<td>" + config.profitTargetFraction + "</td>"
			+ "</tr>";
		logger.log("straddle", logStr);
		capital = 1000;
		numWins = 0;
		numLosses = 0;
		totalProfit = 0;
		maxIntradayDrawdown = 0;
		maxIntradayProfit = 0;
		maxDailyDrawdown = 0;
		maxDailyProfit = 0;
		config.buyAtMinute++;
		simulateScenarios();
	});
}
exports.simulateScenarios = simulateScenarios;

function createTargets(price) {
	config.profitTarget = util.money(config.profitTargetFraction * price);
	config.stopLoss = util.money(config.stopLossFraction * price);
}

var maxDailyDrawdown = Number.POSITIVE_INFINITY;
var maxDailyProfit = Number.NEGATIVE_INFINITY;
function Trader(emitter, broker) {
	
	openingRange = [];
	symbols = [];
	previousMinuteData = [];
	cachedResults = [];

}

exports.Trader = Trader;
var total = 0;
var numTrades = 0;
var timeStarted = new Date();

var capital = 1000;
var feePerTrade = 4.95;
var feePerOption = .65;

function adjustCapital(trade) {
	capital -= feePerTrade * 2;
	var costPerOption = trade.combinedPurchasePrice * 100;
	var numOptions = Math.floor(capital / (costPerOption + (feePerOption / 100)));
	capital -= feePerOption * numOptions;
	capital += numOptions * (trade.profit * 100);
	if (capital < 0) {
		capital = 0;
	}
}

function simulateDates(from, to, callback) {
	
	var day = from;
	var symbolName = "IWM";

	if (!underlyingSymbolBarsCache[symbolName]) {
		underlyingSymbolBarsCache[symbolName] = [];
	}
	if (!dataCache[symbolName]) {
		dataCache[symbolName] = [];
	}
	
	if (day.getDay() === 6 || day.getDay() === 0) {
		day = util.getNextDay(day);
		return simulateDates(day, to, callback);
	}
	if (from <= to) {

		var buyTime = util.minuteNumToTime(config.buyAtMinute, from);
		straddle(symbolName, buyTime, function(err, trade) {
			
			//if (err) console.log("simulate error", err);
			
			if (trade && maxIntradayProfit) {

				numTrades++;

				//console.log("nopes:", numDaysWithoutData, "perfect trades:", util.money(total), " traded: ", totalProfit, "w/l:", util.money(numWins/(numWins + numLosses)), "capital:", capital);
				adjustCapital(trade);

				maxDailyDrawdown = capital < maxDailyDrawdown ? capital : maxDailyDrawdown;
				maxDailyProfit = capital > maxDailyProfit ? capital : maxDailyProfit;

				
			}
			simulateDates(util.getNextDay(day), to, callback);
		});
	}
	else {
		console.log("simulation completed in", util.money((new Date().getTime() - timeStarted.getTime())/1000), "seconds");
		callback(null);
	}

}
exports.simulateDates = simulateDates;

var underlyingSymbolBarsCache = [];
var optionBarsCache = [];
var dataCache = [];

function straddle(symbolName, buyTime, callback) {

	var buyDate = util.getMostRecentMidnight(buyTime);

	if (!underlyingSymbolBarsCache[symbolName]) {
		underlyingSymbolBarsCache[symbolName] = [];
	}

	async.waterfall([
		function(callback) {

			if (underlyingSymbolBarsCache[symbolName][buyTime]) {
				if (underlyingSymbolBarsCache[symbolName][buyTime] === "nope") {

					return callback("nope");
				}
				createTargets(underlyingSymbolBarsCache[symbolName][buyTime].close);

				return callback(null, util.closestOptionPrice(symbolName, underlyingSymbolBarsCache[symbolName][buyTime].close));
			}

			db.getMinuteBarNum(symbolName, buyTime, util.getMinuteNum(buyTime), function(err, result) {
				console.log("getting underlying symbol price");
				if (err) { throw new Error(err)};
				if (!result.length) {
					underlyingSymbolBarsCache[symbolName][buyTime] = "nope";
					console.log("underlying", buyTime);
					return callback("nope");
				}
				createTargets(result[0].close);
				underlyingSymbolBarsCache[symbolName][buyTime] = result[0];
				
				callback(null, util.closestOptionPrice(symbolName, result[0].close));
			});
		},
		function(closestOptionPrice, callback) {
			var callName = util.getOptionName(symbolName, buyTime, closestOptionPrice, "CALL");
			var putName = util.getOptionName(symbolName, buyTime, closestOptionPrice, "PUT");
			if (optionBarsCache[putName]) {
				if (optionBarsCache[putName] === "nope") {
					return callback("nope");
				}
				return callback(null, callName, optionBarsCache[putName]);
			}
			db.getOptionPrices(putName, buyTime, function(err, putData) {
				console.log("getting put prices");
				if (!putData.length) {
					optionBarsCache[putName] = "nope";
					console.log("put", buyTime);
					return callback("nope");
				}
				if (err) { throw new Error(err)};
				optionBarsCache[putName]= putData;
				callback(null, callName, putData);
			});
    	},
		function(callName, putData, callback) {
			if (optionBarsCache[callName]) {
				if (optionBarsCache[callName] === "nope") {
					return callback("nope");
				}
				return callback(null, {putData: putData, callData: optionBarsCache[callName]})
			}
			db.getOptionPrices(callName, buyTime, function(err, callData) {
				console.log("getting call prices");
				if (err) { throw new Error(err)};
				if (!callData.length) {
					optionBarsCache[callName] = "nope";
					console.log("call", buyTime);
					return callback("nope");
				}
				optionBarsCache[callName] = callData;
				callback(null, {putData: putData, callData: callData});
			});
		},
		function(data, callback) {
			
			if (data.putData.length && data.callData.length) {
				simulate(data, buyTime, function(err, result) {
				if (err) { throw new Error(err)};
					callback(null, result);
				});
			}
			else {
				callback("nope");
			}
			
		}
	],
	function(err, result) {
		if (err === "nope") {
			numDaysWithoutData++;
			callback(err);
		}
		else {
			callback(null, result)
		}
	});
}
exports.straddle = straddle;

function simulate(data, buyTime, callback) {
	var tradeOpen = true;
	var trade = {
		putPurchaseTime: undefined,
		callPurchaseTime: undefined,
		putPurchasePrice: undefined,
		callPurchasePrice: undefined,
		combinedPurchasePrice: undefined,
		maxProfit: Number.NEGATIVE_INFINITY,
		maxDrawdown: Number.POSITIVE_INFINITY,
		profit: 0
	}

	var combinedPrices = {
		putData: [],
		callData: []
	}
	var i = 0;
	var n = 0;
	while(i < data.putData.length) {
		if (data.putData[i].dateTime < buyTime) {
			i++;
			continue;
		}
		// TODO: allow overnight holding

		if (util.getMostRecentMidnight(data.putData[i].dateTime) > util.getMostRecentMidnight(buyTime)) {
			break;
		}
		if (!trade.putPurchasePrice) {
			//console.log("Buying put at " + data.putData[i].dateTime);
			trade.putPurchasePrice = data.putData[i].open;
			trade.putPurchaseTime = data.putData[i].dateTime;
			trade.putPurchaseMinuteNum = n;
		}
		var dataMinuteNum = util.getMinuteNum(data.putData[i].dateTime);
		while (n <= dataMinuteNum) {
			combinedPrices.putData[n] = data.putData[i];
			n++;
		}
		i++;
	}

	var callPurchased = false;
	var j = 0;
	n = 0;
	while(j < data.callData.length) {
		if (data.callData[j].dateTime < buyTime) {
			j++;
			continue;
		}
		if (util.getMostRecentMidnight(data.callData[j].dateTime) > util.getMostRecentMidnight(buyTime)) {
			break;
		}
		if (!trade.callPurchasePrice && data.callData[j].dateTime >= buyTime) {
			//console.log("Buying call at " + data.callData[j].dateTime);
			trade.callPurchasePrice = data.callData[j].open;
			trade.callPurchaseTime = data.callData[j].dateTime;
			trade.callPurchaseMinuteNum = n;
		}
		dataMinuteNum = util.getMinuteNum(data.callData[j].dateTime);
		while (n <= dataMinuteNum) {
			combinedPrices.callData[n] = data.callData[j];
			n++;
		}
		j++;
	}
	trade.combinedPurchasePrice = trade.putPurchasePrice + trade.callPurchasePrice;
	var start = trade.callPurchaseMinuteNum > trade.putPurchaseMinuteNum ? trade.callPurchaseMinuteNum : trade.putPurchaseMinuteNum;

	for (var k = start; k < combinedPrices.putData.length; k++) {
		if (!combinedPrices.putData[k] || !combinedPrices.callData[k]) {
			console.log("exiting early at " + k);
			trade.profit = combinedPrices.callData[k-1].low + combinedPrices.putData[k-1].low - trade.combinedPurchasePrice;
			if (trade.profit > maxIntradayProfit) {
				maxIntradayProfit = trade.profit;
			}
			if (trade.profit < maxIntradayDrawdown) {
				maxIntradayDrawdown = trade.profit;
			}
			if (tradeOpen) {
				trade.profit = lastProfit;
				if (trade.profit > 0) {
					numWins++;
				}
				else {
					numLosses++;
				}
				totalProfit += trade.profit;
			}
			return callback(null, trade);
		}
		
		lastProfit = trade.profit;
		// TODO: what happens when we switch order to account for same minute sale
		trade.profit = combinedPrices.callData[k].low + combinedPrices.putData[k].low - trade.combinedPurchasePrice;
		if (tradeOpen && trade.profit < config.stopLoss) {
			tradeOpen = false;
			numLosses++;
			totalProfit += trade.profit;
			if (trade.profit > maxIntradayProfit) {
				maxIntradayProfit = trade.profit;
			}
			if (trade.profit < maxIntradayDrawdown) {
				maxIntradayDrawdown = trade.profit;
			}
			return callback(null, trade);
		}
		trade.profit = combinedPrices.callData[k].high + combinedPrices.putData[k].high - trade.combinedPurchasePrice;

		if (tradeOpen
			&& config.adjustProfitTarget
			&& trade.profit > lastProfit) {
			if (trade.profit > maxIntradayProfit) {
				maxIntradayProfit = trade.profit;
			}
			if (trade.profit < maxIntradayDrawdown) {
				maxIntradayDrawdown = trade.profit;
			}
		}

		else if (tradeOpen
			&& trade.profit >= config.profitTarget) {

			tradeOpen = false;
			numWins++;
			totalProfit += trade.profit;
			if (trade.profit > maxIntradayProfit) {
				maxIntradayProfit = trade.profit;
			}
			if (trade.profit < maxIntradayDrawdown) {
				maxIntradayDrawdown = trade.profit;
			}
			return callback(null, trade);
		}
		else {
			if (trade.profit > maxIntradayProfit) {
				maxIntradayProfit = trade.profit;
			}
			if (trade.profit < maxIntradayDrawdown) {
				maxIntradayDrawdown = trade.profit;
			}
		}


	}

	callback(null, trade);
	
}



