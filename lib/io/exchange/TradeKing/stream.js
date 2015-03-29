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

var oa = new OAuth(null, null, credentials.consumer_key, credentials.consumer_secret, "1.0", null, "HMAC-SHA1");

function init(symbols, callback) {

	symbols = symbols || ['AAPL', 'IWM', 'SPY'];
	
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

		response.setEncoding('utf8');

		response.on('data', emittData);

	    callback(null, emitter);

	});

	request.end();

}

exports.init = init;

function emittData(data) {
	if (data.trade) {

		console.log("Received trade info for ", data.symbol);

		var bar = {
			/*
			{"trade":{"cvol":"37725135","datetime":"2015-03-17T14:08:11-04:00","exch":"The Trade Reporting Facility LLC","last":"127.2378","symbol":"AAPL","tcond":"9","timestamp":"1426615691","vl":"5","vwap":"126.2358"}}
			*/
			exchangeId: 2,
			symbolName: data.trade.symbol,
			dateTime: new Date(data.trade.timestamp),
			price: data.trade.last,
			volume: data.trade.v1
		}

		emitter.emit("data", bar);

	}
	else {
		// In the future, we might wnt to record quotes
		// as well as trades
		//emitter.emit("data", data);
	}

}