"use strict";
var logger = require('../log/logger.js');

var emitter, broker, openingRange, trades;
var self = this;

var config = {
	openingRangeStopLossFactor: 1,
	openingRangeTakeProfitFactor: 2,
	profitableButDecliningFactor: .75,
	numOpeningMinutes: 7,
	maximumLoss: .05

}

function Trader(emitter, broker) {
	self.broker = broker;
	this.emitter = emitter;
	this.emitter.on("data", think);

	openingRange = [];

	trades = [];

/*
	trades["IWM"] = {
		position: "SHORT",
		symbol: "IWM",
		largestProfit: Number.NEGATIVE_INFINITY,
		stopLoss: 121,
		profitTarget: 123,
		entry: 122.75
	}
	buy(trades["IWM"]);
	setTimeout(sellIWM, 4000)
	function sellIWM() {
		sell(trades["IWM"], {close:121}, "ANY");
	}
*/
}

exports.Trader = Trader;
var debugStr = "";

function think(data) {
	if (data.end) {
		endDay();
		return;
	}

	if (!trades[data.symbolName]) {
		resetTrade(data.symbolName);
	}
	/* TODO: why is data.last not here?
	if (data.type === "trade") {
		console.log(data)
		process.exit();
	}
	
	if (data.type === "quote") {
		console.log(data)
		process.exit();
	}
	*/
	if (data.type === "trade"
		|| (data.type === "quote"
			&& self.broker.simulated
			&& data.dateTime.getHours() === 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() < 30 + config.numOpeningMinutes)) {

		if (/*1===1 || */(data.dateTime.getHours() === 8
			&& data.dateTime.getMinutes() >= 30
			&& data.dateTime.getMinutes() < 30 + config.numOpeningMinutes)) {

			if (!openingRange[data.symbolName]) {
				openingRange[data.symbolName] = {
					high: Number.NEGATIVE_INFINITY,
					low: Number.POSITIVE_INFINITY
				};
				
			}

			var lastHigh = openingRange[data.symbolName].high;
			var lastLow = openingRange[data.symbolName].low;

			if (data.type === "trade") {

				openingRange[data.symbolName].high = (data.last > openingRange[data.symbolName].high) ? +data.last : openingRange[data.symbolName].high;
				openingRange[data.symbolName].low = (data.last < openingRange[data.symbolName].low) ? +data.last : openingRange[data.symbolName].low;

			}
			else if (data.type === "quote") {

				openingRange[data.symbolName].high = (data.ask > openingRange[data.symbolName].high) ? +data.ask : openingRange[data.symbolName].high;
				openingRange[data.symbolName].low = (data.bid < openingRange[data.symbolName].low) ? +data.bid : openingRange[data.symbolName].low;
			}
		}
	}
	/* TODO: only seems to make one trade per symbol instead of one long and one short trade per symbol */
	else if (data.type === "quote"
		&& openingRange[data.symbolName]
		&& !trades[data.symbolName].position
		&& data.dateTime.getHours() >= 8
		&& data.dateTime.getMinutes() >= 30 + config.numOpeningMinutes) {
		// TODO: dry this out

		if (data.ask > openingRange[data.symbolName].high
			&& trades[data.symbolName].wentLong === false
			&& trades[data.symbolName].wentShort === false) {
			
			trades[data.symbolName] = {
				wentLong: true,
				position: "LONG",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].high - (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].high + (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: data.ask
			}
			console.log("calculating stop loss. Opening range high is "
				+ openingRange[data.symbolName].high
				+ ", stop loss factor is "
				+ config.openingRangeStopLossFactor
				+ " so, \n"
				+ openingRange[data.symbolName].high + " - (" + config.openingRangeStopLossFactor + " * (" + openingRange[data.symbolName].high + " - " + openingRange[data.symbolName].low + ")");
			buy(trades[data.symbolName], data);
		}
		else if (data.bid < openingRange[data.symbolName].low
			&& trades[data.symbolName].wentShort === false
			&& trades[data.symbolName].wentLong === false) {
			trades[data.symbolName] = {
				wentShort: true,
				position: "SHORT",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].low + (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].low - (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: data.bid
			}
			console.log("calculating stop loss. Opening range low is "
				+ openingRange[data.symbolName].low
				+ ", stop loss factor is "
				+ config.openingRangeStopLossFactor
				+ " and opening range low is "
				+ openingRange[data.symbolName].low
				+ " so, \n"
				+ openingRange[data.symbolName].low + " + (" + config.openingRangeStopLossFactor + " * (" + openingRange[data.symbolName].high + " - " + openingRange[data.symbolName].low + ")");
			buy(trades[data.symbolName], data);
		}
	}
	else if (data.type === "quote"
		&& trades[data.symbolName]
		&& trades[data.symbolName].position === "LONG") {

		var profit = data.bid - trades[data.symbolName].entry;
		trades[data.symbolName].largestProfit = profit > trades[data.symbolName].largestProfit ? profit : trades[data.symbolName].largestProfit;

	// stop loss hit?

		if (trades[data.symbolName].stopLoss >= data.bid) {
			console.log("stop loss is " + trades[data.symbolName].stopLoss + " and current bid is " + data.bid + " and I'm long. Sell.");
			sell(trades[data.symbolName], data, "stop loss");
		}
	// profit target hit? openingRangeTakeProfitFactor
		else if (trades[data.symbolName].profitTarget <= data.bid) {
			sell(trades[data.symbolName], data, "profit target");
		}

	// maximum loss hit?
		else if (trades[data.symbolName].profit <= config.maximumLoss) {
			sell(trades[data.symbolName], data, "maximum loss");
		}

	// profitable but declining?
		else if (profit >= config.smallestTakableProfit
			&& profit <= trades[data.symbolName].largestProfit * config.profitableButDecliningFactor) {
			
			sell(trades[data.symbolName], data, "profitable but declining");
		}

	}

	else if (data.type === "quote"
		&& trades[data.symbolName]
		&& trades[data.symbolName].position === "SHORT") {

		var profit = trades[data.symbolName].entry - data.ask;
		trades[data.symbolName].largestProfit = profit > trades[data.symbolName].largestProfit ? profit : trades[data.symbolName].largestProfit;

		// stop loss hit?
		
		if (trades[data.symbolName].stopLoss <= data.ask) {
			console.log("stop loss is " + trades[data.symbolName].stopLoss + " and current ask is " + data.ask + " and I'm short. Sell.");
			sell(trades[data.symbolName], data, "stop loss");
		}

		// profit target hit? openingRangeTakeProfitFactor
		else if (trades[data.symbolName].profitTarget >= data.ask) {
			sell(trades[data.symbolName], data, "profit target");
		}

		// profitable but declining?
		else if (profit >= config.smallestTakableProfit
			&& profit <= trades[data.symbolName].largestProfit / config.profitableButDecliningFactor) {
			sell(trades[data.symbolName], data, "profitable but declining");
		}

	}
	else if (data.position
		&& data.dateTime.getHours() === 14
		&& data.dateTime.getMinutes() >= 57) {
		sell(trades[data.symbolName], data, "end of session");
	}

	if (data.type === "quote") {
		lastQuotes[data.symbolName] = data;
	}
	//console.log(data);
}

/* TODO: don't need to pass trade here */
function buy(trade, data) {
	logger.log("opening-range", {symbol: data.symbolName, range: openingRange[data.symbolName], dateTime: data.dateTime.toString()});
console.log("buying ", trade.symbol, "at", data.dateTime);
	self.broker.buyOptions(trades[trade.symbol], function(err, result) {
		if (err) return logger.log("option-purchase-error", trade);
		trades[trade.symbol].optionName = result.optionName;
		trades[trade.symbol].optionEntryPrice = result.optionPrice;
		trades[trade.symbol].entryTime = data.dateTime.getHours() + ":" + data.dateTime.getMinutes();
		logger.log("buy", trades[trade.symbol]);
	});
	
}

/* TODO: don't need to pass trade here */
function sell(trade, data, type) {

	console.log("selling ", trade.symbol, "at", data.dateTime);

	self.broker.sellOptions(trades[trade.symbol], function(err, result) {
		if (err) {
			return logger.log("option-purchase-error", trade);
		}

		trade.exitTime = data.dateTime.getHours() + ":" + data.dateTime.getMinutes();
		trade.exit = trade.position === "LONG" ? data.bid : data.ask;
		trade.optionExitPrice = result.optionPrice;
		trade.profit = trade.position === "LONG" ? trade.exit - trade.entry : trade.entry - trade.exit;
		trade.optionProfit = trade.optionExitPrice - trade.optionEntryPrice;
		trade.exitType = type;
		logResult(trade.symbol);
		trades[trade.symbol].position = null;
	});

}
var tradeTotals = {
	"IWM": 0,
	"SPY": 0,
	"QQQ": 0,
	"AAPL": 0,
	"FB": 0
};
var lastQuotes = {
	"IWM": null,
	"SPY": null,
	"QQQ": null,
	"AAPL": null,
	"FB": null
};
function endDay() {
	console.log('ending day');

	debugStr += "ending day\n";

	for (var symbol in trades) {
		if (trades[symbol].position) {
			debugStr += symbol + " has position\n";
			sell(trades[symbol], lastQuotes[symbol], "day ended while holding position");
		}
		
	}
	console.log("debug", debugStr);

	logger.log("end", debugStr);
	for (var i in trades) {
		console.log(i);
		delete trades[i];
		delete openingRange[i];
		delete lastQuotes[i];
	}
}

function resetTrade(symbol) {
	trades[symbol] = null; 
	trades[symbol] = {
		position: null,
		wentLong: false,
		wentShort: false
	};
}

function logResult(symbol) {
	if (trades[symbol]
		&& !isNaN(parseFloat(trades[symbol].profit))
		&& isFinite(trades[symbol].profit)) {
		tradeTotals[symbol] += trades[symbol].profit;
		logger.log(symbol, {today: trades[symbol].profit, position: trades[symbol].position, exitType: trades[symbol].exitType, total: tradeTotals[symbol]});
	}
	else {
		logger.log("big error", trades[symbol]);
	}
}