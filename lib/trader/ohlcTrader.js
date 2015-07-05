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
		numOpeningMinutes: 2,
		riskFactor: .5

end SPY 0 0 0.6666666666666666
end QQQ 0.08 5.41 0.5
end IWM 0.05 3.71 0.5441176470588235
end FB 0.1 6.57 0.5079365079365079
end AAPL 0.06 3.67 0.3898305084745763	

numOpeningMinutes: 4,
riskFactor: .5
end SPY 0.18 1.07 0.6666666666666666
end QQQ 0.08 5.41 0.5
end IWM 0.05 3.71 0.5441176470588235
end FB 0.1 6.57 0.5079365079365079
end AAPL 0.06 3.67 0.3898305084745763

numOpeningMinutes: 4,
riskFactor: .5
end SPY 0.11 0.77 0.7142857142857143
end QQQ 0.05 3.8 0.49295774647887325
end IWM 0.03 1.76 0.4603174603174603
end FB 0.15 8.34 0.45614035087719296
end AAPL 0.15 7.71 0.5283018867924528

numOpeningMinutes: 5,
riskFactor: .5

end SPY 0.08 0.4 0.6
end QQQ 0.07 4.77 0.4375
end IWM 0.08 5.06 0.3484848484848485
end FB 0.12 7.42 0.359375
end AAPL 0.1 6.67 0.35384615384615387

numOpeningMinutes: 6,
riskFactor: .5
end SPY -0.04 -0.36 0.8
end QQQ 0.07 4.86 0.5074626865671642
end IWM 0.06 4.17 0.4696969696969697
end FB 0.1 7.09 0.352112676056338
end AAPL 0.11 7.09 0.3787878787878788

end SPY 0.1 1.75 0.7777777777777778
end QQQ 0.07 4.86 0.5074626865671642
end IWM 0.06 4.17 0.4696969696969697
end FB 0.1 7.09 0.352112676056338
end AAPL 0.11 7.09 0.3787878787878788

end SPY 0.09 2.67 0.4482758620689655
end QQQ 0.05 3.87 0.4666666666666667
end IWM 0.04 2.73 0.48484848484848486
end FB 0.16 9.17 0.4915254237288136
end AAPL 0.12 7.06 0.5
*/

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