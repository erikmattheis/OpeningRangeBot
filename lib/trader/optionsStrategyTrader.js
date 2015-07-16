
"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js'),
	db = require("../io/mongo/db.js"),
	async = require("async");

var config = {
	numOpeningMinutes: 1,
	riskFactor: .5,
	shyFactor: 1,
	requireDirectionCheck: true,
	thinkOutLoud: true,
	maxLoss: .1,
	useMaxLoss: false
}

var emitter, broker, openingRange, symbols, previousMinuteData, previousTodayString, cachedResults;

function Trader(emitter, broker) {

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

function straddle(symbolName, buyTime, price) {
	var callName = util.getOptionName(symbolName, buyTime, price, "CALL");
	var putName = util.getOptionName(symbolName, buyTime, price, "PUT");

	async.waterfall([
		function(callback) {
			db.getOptionPriceAtTime(putName, buyTime, function(err, putData) {
				if (err) { throw new Error(err)};
				callback(null, putData);
			});
    	},
		function(putData, callback) {
			db.getOptionPriceAtTime(callName, buyTime, function(err, callData) {
				if (err) { throw new Error(err)};
				callback(null, {putData: putData, callData: callData});
			});
		},
		function(data, callback) {
			simulate(data, buyTime, function(err, result) {
				if (err) { throw new Error(err)};
				console.log(result);
				process.exit(0);
			});
		}
	]);
}
exports.straddle = straddle;

function simulate(data, buyTime, callback) {

	var trade = {
		putPurchaseTime: undefined,
		callPurchaseTime: undefined,
		putPurchasePrice: undefined,
		callPurchasePrice: undefined,
		combinedPurchasePrice: undefined,
		maxProfit: Number.NEGATIVE_INFINITY,
		maxDrawdown: Number.POSITIVE_INFINITY,
		maxProfitTime: undefined,
		maxDrawdownTime: undefined,
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
			console.log("Buying put at " + data.putData[i].dateTime);
			trade.putPurchasePrice = data.putData[i].high;
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
			console.log("Buying call at " + data.callData[j].dateTime);
			trade.callPurchasePrice = data.callData[j].high;
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

	var profit;
	for (var k = start; k < combinedPrices.putData.length; k++) {
		if (!combinedPrices.putData[k] || !combinedPrices.callData[k]) {
			console.log("exiting early at " + k);
			callback(null, trade);
		}
		profit = combinedPrices.callData[k].low + combinedPrices.putData[k].low - trade.combinedPurchasePrice;
		if (profit > trade.maxProfit) {
			trade.maxProfit = profit;
			trade.maxProfitTime = combinedPrices.putData[k].dateTime;
		}
		if (profit < trade.maxDrawdown) {
			trade.maxDrawdown = profit;
			trade.maxDrawdownTime = combinedPrices.putData[k].dateTime;
		}
	}

	callback(null, trade);
	
}



