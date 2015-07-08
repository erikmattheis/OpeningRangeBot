"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

	var config = {
		numOpeningMinutes: 4,
		riskFactor: .5,
		shyFactor: 1.4
	}
/*
end TRIN 0.09 7.08 0.8846153846153846
end TICK 180.71 19155 0.9056603773584906
end SPY 0.16 16.27 0.9191919191919192
end QQQ 0.09 8.65 0.875
end IWM 0.11 9.88 0.8723404255319149
end FB 0.2 17.71 0.9111111111111111
end AAPL 0.25 20.88 0.9285714285714286

end TICK 193.53 20321.15 0.9047619047619048
end SPY 0.18 16.99 0.9270833333333334
end QQQ 0.09 8.98 0.865979381443299
end IWM 0.11 10.84 0.865979381443299
end FB 0.2 17.84 0.9120879120879121
end AAPL 0.21 17.85 0.9310344827586207

end TRIN 0.1 7.83 0.8961038961038961
end TICK 189.23 19301 0.9215686274509803
end SPY 0.17 17.46 0.89
end QQQ 0.1 8.83 0.9111111111111111
end IWM 0.09 8.9 0.8631578947368421
end FB 0.18 16.36 0.9213483146067416
end AAPL 0.25 20.88 0.9390243902439024

		numOpeningMinutes: 4,
		riskFactor: .5,
		shyFactor: 1.4
end TRIN 0.1 7.72 0.918918918918919
end TICK 178.82 17524.5 0.8979591836734694
end SPY 0.15 13.7 0.8829787234042553
end QQQ 0.08 7.16 0.8651685393258427
end IWM 0.09 8.17 0.8526315789473684
end FB 0.17 14.84 0.9411764705882353
end AAPL 0.23 18.58 0.95

		numOpeningMinutes: 4,
		riskFactor: .5,
		shyFactor: 1.4
end TRIN 0.11 9.29 0.8795180722891566
end TICK 171.55 16983.15 0.8787878787878788
end SPY 0.19 18.31 0.90625
end QQQ 0.1 9.93 0.8921568627450981
end IWM 0.11 11.12 0.8712871287128713
end FB 0.19 17.89 0.9456521739130435
end AAPL 0.25 21.77 0.8863636363636364
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
	// TODO: Sending this wrong somewhere
	if (data === "{data:end}"
		|| data.end) {

		var result = [];

		for (var i in symbols) {
			if (symbols.hasOwnProperty(i)) {

				result[i] = {
					position: symbols[i].position,
					purchasePrice: symbols[i].openAt,
					purchaseTime: util.minuteNumToTime(symbols[i].openedAtMinuteNum, symbols[i].date),
					salePrice: symbols[i].closeAt,
					saleTime: util.minuteNumToTime(symbols[i].closedAtMinuteNum, symbols[i].date)

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

	// TODO: should start entirely new symbol object each new day instead
	symbols[data.symbolName].date = data.dateTime;

	if (data.dateTime.getHours() === 8
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
				// TODO: -.05 improves results but should be made dynamic
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].lows) - .1;
				symbols[data.symbolName].closeAt = extendTrend(symbols[data.symbolName].highs);
				symbols[data.symbolName].stopLoss = symbols[data.symbolName].openAt - ((symbols[data.symbolName].closeAt - symbols[data.symbolName].openAt) * config.riskFactor);
				console.log("long on", data.symbolName, symbols[data.symbolName].openAt, symbols[data.symbolName].closeAt, symbols[data.symbolName].stopLoss)
			}

			else if (lowerLows && !higherHighs) {
				symbols[data.symbolName].position = "SHORT";
				symbols[data.symbolName].openedAtMinuteNum = minuteNum;
				// TODO: -.05 improves results but should be made dynamic
				symbols[data.symbolName].openAt = extendTrend(symbols[data.symbolName].highs) + .1;
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
				console.log("Opened position");

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
					if (symbols[data.symbolName].stopLoss < symbols[data.symbolName].openAt) {
						symbols[data.symbolName].numLosses++;
					}
					else {
						symbols[data.symbolName].numWins++;
					}
					symbols[data.symbolName].stopLoss = symbols[data.symbolName].stopLoss < data.open ? symbols[data.symbolName].stopLoss : data.open;
					symbols[data.symbolName].profit += symbols[data.symbolName].stopLoss - symbols[data.symbolName].openAt;
					console.log("closed position on stop loss")
				}
				else if (data.high >= symbols[data.symbolName].closeAt) {
					console.log("closing or adjusting")
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
		console.log("changing")
		symbols[symbolName].closeAt = extendTrend(symbols[symbolName].highs);
		symbols[symbolName].stopLoss = data.close - ((symbols[symbolName].closeAt - data.close) * config.riskFactor);
		console.log(data.close, symbols[symbolName].closeAt, data.close, config.riskFactor)
		console.log("adjusting to", symbols[symbolName].closeAt, symbols[symbolName].stopLoss)
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
		symbols[symbolName].stopLoss = data.close + ((symbols[symbolName].closeAt - data.close) * config.riskFactor);
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