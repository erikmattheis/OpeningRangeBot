var OAuth = require('oauth').OAuth,
	fs = require('fs'),
	Emitter = require('events').EventEmitter,
	config = require('../../../config/config.json');

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
		callback(null, _emitter)
	    response.setEncoding('utf8');
	    response.on('data', function(data) {
	    	data = JSON.parse(data);
	    	_emitter.emit("data", data);
	    });
	});
	request.end();
}

exports.init = init;