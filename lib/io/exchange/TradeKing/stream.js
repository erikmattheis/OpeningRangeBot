"use strict";

var OAuth = require('oauth').OAuth,
	fs = require('fs'),
	Emitter = require('events').EventEmitter,
	config = require('../../../config/config-private.json'),
	db = require('../../../io/mongo/db.js'),
	logger = require('../../../log/logger.js'),
	util = require('../../../util/util.js');
/*
Untracked in this repo is /lib/config/config-private.json 
which should look like this:
{
	"credentials": {
		"TradeKing": {
			"consumer_key": "[your consumer_key]",
			"consumer_secret": "[your consumer_secret]",
			"access_token": "[your access_token]",
			"access_secret": "[your access_secret]"
		}
	}
}

*/
var credentials = {
	consumer_key: config.credentials.TradeKing.consumer_key,
	consumer_secret: config.credentials.TradeKing.consumer_secret,
	access_token: config.credentials.TradeKing.access_token,
	access_secret: config.credentials.TradeKing.access_secret
};

var emitter = new Emitter();

var numErrors = 0;
var buffer = '';
var currentMinuteBars = [];
var lastPrices = [];

var oa = new OAuth(null, null, credentials.consumer_key, credentials.consumer_secret, "1.0", null, "HMAC-SHA1");

function initiateSymbolObjects(symbols) {
	symbols.forEach(function(symbol) {
		lastPrices[symbol] = null;
		resetCurrentMinuteBar(symbol, Number.NEGATIVE_INFINITY, null);
	});
}


function init(symbols, callback) {

	symbols = symbols || ['AAPL', 'IWM', 'SPY'];

	initiateSymbolObjects(symbols);
	
	var request = oa.get(
		"https://stream.tradeking.com/v1/market/quotes.json?symbols=" + symbols.toString(),
		credentials.access_token,
		credentials.access_secret);

	request.on('error', function (error) {
		setTimeout(function() {
			init(symbols, callback);
		}, 3000);
		return logger.log("stream-error", error);
	});

	request.on('response', function (response) {

		if (response.statusCode !== 200) {
			callback("Could not connect - http status code was " + response.statusCode);
			console.log("Trying again in 3 seconds.")
			return setTimeout(function() {
				init(symbols, callback);
			}, 3000);
		}
		else {
			console.log("TradeKing stream initiated for ", symbols.toString());
			

			/*
			getOptions("IWM", new Date(), 121, 123, function(e, response) {

				if (e) return console.error(e);

				//console.log(response);

			});
	*/

		}

		/*response.setEncoding('utf8');*/

		callback(null, emitter);
		response.on('data', consumeData);

	    

	});

	request.end();

}

exports.init = init;

function buyOptions(trade, callback) {
	/*
				trades[data.symbolName] = {
				position: "SHORT",
				symbol: data.symbolName,
				largestProfit: Number.NEGATIVE_INFINITY,
				stopLoss: openingRange[data.symbolName].low + (config.openingRangeStopLossFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				profitTarget: openingRange[data.symbolName].low - (config.openingRangeTakeProfitFactor * (openingRange[data.symbolName].high - openingRange[data.symbolName].low)),
				entry: data.close
	*/
	getOptions(trade.symbol, new Date(), trade.entry - 1, trade.entry + 1, function(err, result) {



		if (trade.position === "LONG") {
			result.quotes["quote"].sort(
				function(x, y){ 
					if (+x["strikeprice"] < +y["strikeprice"]) {
						return 1;
					}
					if (+x["strikeprice"] > +y["strikeprice"]) {
						return -1;
					}
					return 0;
				}
			);
			for (var i in result.quotes["quote"]) {
				if (result.quotes["quote"][i]["put_call"] === "call"
					&& trade.entry < +result.quotes["quote"][i]["strikeprice"]) {
					// first in-the-money option
					return callback(null, {
						optionName: result.quotes["quote"][i]["symbol"],
						optionPrice: +result.quotes["quote"][i]["ask"]
					});
				}
			}
		}
		else if (trade.position === "SHORT") {
			result.quotes["quote"].sort(
				function(x, y){ 
					if (+x["strikeprice"] < +y["strikeprice"]) {
						return -1;
					}
					if (+x["strikeprice"] > +y["strikeprice"]) {
						return 1;
					}
					return 0;
				}
			);
			for (var i in result.quotes["quote"]) {
				if (result.quotes["quote"][i]["put_call"] === "put"
					&& trade.entry > +result.quotes["quote"][i]["strikeprice"]) {
					// first in-the-money option
					return callback(null, {
						optionName: result.quotes["quote"][i]["symbol"],
						optionPrice: +result.quotes["quote"][i]["ask"]
					});
				}
			}
		}

		callback(null, result);
		

	});
}

exports.buyOptions = buyOptions;

/*testing:
function dummyData() {
console.log(new Date(1970,2,2,8,31))
		var d = ''
		+ '{"quote":{"symbol":"IWM", "ask":128, "bid": 118, "timestamp":1428276699484, "vl": "100"}}'
		+ '{"trade":{"symbol":"IWM", "last":120, "timestamp":2817060, "vl": "100"}}'
		+ '{"trade":{"symbol":"IWM", "last":121, "timestamp":1428276899485, "vl": "100"}}'
		+ '{"trade":{"symbol":"IWM", "last":119, "timestamp":"1428276899485", "vl": "100"}}'
		+ '{"trade":{"symbol":"IWM", "last":119, "timestamp":1428276999487, "vl": "100"}}'
		+ '{"trade":{"symbol":"IWM", "last":125, "timestamp":1428277999488, "vl": "100"}}';
	consumeData(d);
}
setTimeout(dummyData, 3000)
*/

function consumeData(data) {

	data = data.toString();

	if (data === '{"status":"connected"}') {
		
		return emitter.emit("data", data);

	}

	buffer += data;
	pump();
}

function pump() {
	var pos;

	while ((pos = buffer.indexOf('}}')) >= 0) {
		readPriceObject(buffer.slice(0, pos + 2));
		buffer = buffer.slice(pos + 2);
	}
}

function readPriceObject(data) {

	try {
		data = JSON.parse(data);
	}
	catch (e) {
		console.log("error #", numErrors++);
		console.log("data:", data);
	}

	var barType = Object.keys(data)[0];

	if (!util.isNumeric(data[barType].timestamp)) {
		return logger.log("timestamp-data-error", data);
	}
	var bar = {
		type: barType,
		exchangeId: 2,
		symbolName: data[barType].symbol,
		dateTime: new Date(parseInt(data[barType].timestamp) * 1000),
		timestamp: data[barType].timestamp
	};

	switch(barType) {

		case "trade":
			if (!util.isNumeric(data.trade.last)
				|| !util.isNumeric(data.trade.vl)) {
				console.log('data.trade.last', data.trade.last);
				console.log('data.trade.vl', data.trade.vl);
				return logger.log("trade-data-error", data);
			}
			bar.last = data.trade.last;
			bar.volume = +data.trade.vl;

			lastPrices[bar.symbolName] = data.last;
			updateOHLC(bar);
			emitData(bar);
			break;
		case "quote":
			if (!util.isNumeric(data.quote.ask)
				|| !util.isNumeric(data.quote.bid)) {
				return logger.log("quote-data-error", data);
			}
			bar.ask = data.quote.ask,
			bar.bid = data.quote.bid;
			emitData(bar);
			break;
		default:
			console.log("data is neither trade or quote", data);
			return logger.log("unknown-data-error", data);
		
	}
	
}

function resetCurrentMinuteBar(symbol, seconds, open, volume) {
	seconds = seconds - (seconds % 60);
	// TODO DRY this out
	currentMinuteBars[symbol] = {
		type: "OHLC",
		symbolName: symbol,
		exchangeId: 2,
		dateTime: new Date(seconds * 1000),
		timestamp: seconds,
		open: open,
		high: open,
		low: open,
		close: open,
		volume: volume
	}
}

function updateOHLC(bar) {
	// console.log('second": ', (bar.timestamp - currentMinuteBars[bar.symbolName].timestamp));
	// If there is no current minute data for this symbol

	if (!currentMinuteBars[bar.symbolName]) {
		console.log('not there')
		return logger.log("symbol-error", bar);
	}
	if (isNaN(currentMinuteBars[bar.symbolName].timestamp)) {
		//console.log('first trade', currentMinuteBars[bar.symbolName]);
		resetCurrentMinuteBar(bar.symbolName, bar.timestamp, bar.last, bar.volume);
	}
	// Is this the same minute as currentMinuteBar?
	else if (bar.timestamp - currentMinuteBars[bar.symbolName].timestamp < 60) {
		//console.log('same minute', currentMinuteBars[bar.symbolName]);
		currentMinuteBars[bar.symbolName].high = bar.last > currentMinuteBars[bar.symbolName].high ? bar.last : currentMinuteBars[bar.symbolName].high;
		currentMinuteBars[bar.symbolName].low = bar.price < currentMinuteBars[bar.symbolName].low ? bar.price : currentMinuteBars[bar.symbolName].low;
		currentMinuteBars[bar.symbolName].close = bar.last;
		currentMinuteBars[bar.symbolName].volume += +bar.volume;
	}

	// Else we should emit our current minute bar and create a new one
	else {
		for (var i in currentMinuteBars[bar.symbolName]) {
			if (Number.isNaN(currentMinuteBars[bar.symbolName][i])) {
				console.log('isNaN', currentMinuteBars[bar.symbolName][i]);
				resetCurrentMinuteBar(bar.symbolName, bar.timestamp, bar.last, bar.volume);
				return logger.log('nan-error', currentMinuteBars[bar.symbolName]);
			}
		}
		//console.log(bar.timestamp - currentMinuteBars[bar.symbolName].timestamp);
		//console.log(currentMinuteBars[bar.symbolName]);
		emitData(currentMinuteBars[bar.symbolName]);
		resetCurrentMinuteBar(bar.symbolName, bar.timestamp, bar.last, bar.volume);
	}

}

function emitData(data) {
	emitter.emit("data", data);
}

function getOptions(symbolName, expirationDate, strikeLow, strikeHigh, callback) {

	var tradeking_consumer = new OAuth(
		"https://developers.tradeking.com/oauth/request_token",
		"https://developers.tradeking.com/oauth/access_token",
		config.credentials.TradeKing.consumer_key,
		config.credentials.TradeKing.consumer_secret,
		"1.0",
		"http://mywebsite.com/tradeking/callback",
		"HMAC-SHA1");

	var nextFriday = util.getNextFriday(expirationDate);
	var uri = "https://api.tradeking.com/v1/market/options/search.json?symbol="
		+ symbolName.toUpperCase()
		+ "&query="
		+ encodeURIComponent("xdate-eq:" + nextFriday.getFullYear().toString()
			+ util.pad2(nextFriday.getMonth() + 1).toString()
			+ util.pad2(nextFriday.getDate().toString())
			+ " AND strikeprice-gte:" + strikeLow
			+ " AND strikeprice-lte:" + strikeHigh);

	tradeking_consumer.get(uri,
		config.credentials.TradeKing.access_token,
		config.credentials.TradeKing.access_secret,
		function(error, data, response) {
			if (error) return console.log(error);
			var account_data = JSON.parse(data);
			
			callback(null, account_data.response);
		}
);





}







          
