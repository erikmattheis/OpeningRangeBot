var OAuth = require('oauth').OAuth,
	fs = require('fs'),
	Emitter = require('events').EventEmitter,
	config = require('../../../config/config.json'),
	db = require('../../../io/mongo/db.js');

var credentials = {
    consumer_key: config.credentials.TradeKing.consumer_key,
    consumer_secret: config.credentials.TradeKing.consumer_secret,
    access_token: config.credentials.TradeKing.access_token,
    access_secret: config.credentials.TradeKing.access_secret
};

var _emitter;

var oa = new OAuth(null, null, credentials.consumer_key, credentials.consumer_secret, "1.0", null, "HMAC-SHA1");

function getEmitter() {
	return _emitter;
}
exports.getEmitter = getEmitter;

function init(symbols, callback) {

	symbols = symbols || ['AAPL', 'IWM', 'SPY'];

	_emitter = new Emitter();

	var request = oa.get(
		//"https://api.tradeking.com/v1/market/ext/quotes.json?symbols=TICK"
		"https://stream.tradeking.com/v1/market/quotes.json?symbols=" + symbols.toString(),
		credentials.access_token,
		credentials.access_secret);
		request.on('response', function (response) {

			//if (response.hasOwnProperty("trade")) {
				var bar = {
					/*
					{"trade":{"cvol":"37725135","datetime":"2015-03-17T14:08:11-04:00","exch":"The Trade Reporting Facility LLC","last":"127.2378","symbol":"AAPL","tcond":"9","timestamp":"1426615691","vl":"5","vwap":"126.2358"}}
					*/
					exchange: 2,
					symbolName: response.symbol,
					dateTime: new Date(response.timestamp),
					price: response.last,
					volume: response.v1
				}
				db.createBar(bar, function(err, result) {
					if (err) return console.log(err);
					console.log("big!", result);
				});
			//}
		callback(null);
	    response.setEncoding('utf8');
	    response.on('data', function(data) {
	    	console.log("data:", data)
	    	data = JSON.parse(data);
	    	_emitter.emit("data", data);
	    });
	});
	request.end();
}

exports.init = init;