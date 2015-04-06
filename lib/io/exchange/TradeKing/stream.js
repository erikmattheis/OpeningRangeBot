"use strict";

var OAuth = require('oauth').OAuth,
	fs = require('fs'),
	Emitter = require('events').EventEmitter,
	config = require('../../../config/config-private.json'),
	db = require('../../../io/mongo/db.js');
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
		}

		/*response.setEncoding('utf8');*/

		response.on('data', consumeData);

	    callback(null, emitter);

	});

	request.end();

}

exports.init = init;

/*testing:
function dummyData() {

		var d = ''
		+ '{"quote":{"symbol":"IWM", "ask":128, "bid": 118, "timestamp":1428276899484, "vl": 100}}'
		+ '{"trade":{"symbol":"IWM", "last":120, "timestamp":1428276899484, "vl": 100}}'
		+ '{"trade":{"symbol":"IWM", "last":121, "timestamp":1428276899485, "vl": 100}}'
		+ '{"trade":{"symbol":"IWM", "last":119, "timestamp":1428276899486, "vl": 100}}'
		+ '{"trade":{"symbol":"IWM", "last":125, "timestamp":1428276999487, "vl": 100}}'
		+ '{"trade":{"symbol":"IWM", "last":125, "timestamp":1428277999488, "vl": 100}}';
	consumeData(d);
}
setTimeout(dummyData,1000)
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
	var bar = {
		type: barType,
		exchangeId: 2,
		symbolName: data[barType].symbol,
		dateTime: new Date(parseInt(data[barType].timestamp)),
		timestamp: data[barType].timestamp,
	};

	switch(barType) {

		case "trade": 
			bar.last = data.trade.last;
			bar.volume = data.trade.vl;
			lastPrices[bar.symbolName] = data.last;
			updateOHLC(bar);
			emitData(bar);
			break;
		case "quote":
			bar.ask = data.quote.ask,
			bar.bid = data.quote.bid;
			emitData(bar);
			break;
		default:
			console.log("data is neither trade or quote", data);
	}

	

	
}

function resetCurrentMinuteBar(symbol, ms, open, volume) {
	ms = ms - (ms % 60000);
	// TODO DRY this out
	currentMinuteBars[symbol] = {
		type: "OHLC",
		symbolName: symbol,
		exchangeId: 2,
		dateTime: new Date(ms),
		timestamp: ms,
		open: open,
		high: open,
		low: open,
		close: open,
		volume: volume
	}
}

function updateOHLC(bar) {

	// If there is no current minute data for this symbol
	if (isNaN(currentMinuteBars[bar.symbolName].timestamp)) {
		//console.log('first trade', currentMinuteBars[bar.symbolName]);
		resetCurrentMinuteBar(bar.symbolName, bar.timestamp, bar.last, bar.volume);
	}

	// Is this the same minute as currentMinuteBar?
	else if (bar.timestamp - currentMinuteBars[bar.symbolName].timestamp < 60000) {
		//console.log('same minute', currentMinuteBars[bar.symbolName]);
		currentMinuteBars[bar.symbolName].high = bar.last > currentMinuteBars[bar.symbolName].high ? bar.last : currentMinuteBars[bar.symbolName].high;
		currentMinuteBars[bar.symbolName].low = bar.price < currentMinuteBars[bar.symbolName].low ? bar.price : currentMinuteBars[bar.symbolName].low;
		currentMinuteBars[bar.symbolName].close = bar.last;
		currentMinuteBars[bar.symbolName].volume += bar.volume;
	}

	// Else we should emit our current minute bar and create a new one
	else {
		//console.log('emitting', currentMinuteBars[bar.symbolName]);
		emitData(currentMinuteBars[bar.symbolName]);
		resetCurrentMinuteBar(bar.symbolName, bar.timestamp, bar.last, bar.volume);
	}

}


function emitData(data) {
	emitter.emit("data", data);

}