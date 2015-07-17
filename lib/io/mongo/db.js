"use strict";

var mongoose = require('mongoose'),
util = require('../../util/util.js'),
config = require('../../config/config.json');

function init(callback) {

	mongoose.connect('mongodb://localhost/OpeningRangeBot');

	var db = mongoose.connection;

	db.on('error', console.error.bind(console, 'connection error:'));

	db.once('open', function () {
		// TODO: does this work if there is not yet a bars collection?
		//db.bars.createIndex( { "exchangeId: ": 1, "symbolName": 1, "dateTime": 1} )
		callback(null, true);
	});
	
}

exports.init = init;

function createBar(bar, callback) {

	var bar = new Bar({
		reportedExchange: bar.reportedExchange,
		type: bar.type,
		exchangeId: bar.exchangeId,
		symbolName: bar.symbolName,
		dateTime: bar.dateTime,
		timestamp: bar.timestamp,
		open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,
		ask: bar.ask,
		bid: bar.bid,
		last: bar.last,
		volume: bar.volume
	});

	if (config.checkForNewData) {
		readBar(bar, function(err, result) {

			if (!result) {
				bar.save(function(err, result) {
					callback("recorded " +  bar);
					if (err) return console.error(err);
					callback(null, result);
				});
			}
			else {
				callback("Similar bar exists " +  bar);
			}

		});
	}
	else {
		bar.save(function(err, result) {
			//callback("recorded " +  bar);
			if (err) return console.error('bar.save', err);
			callback(null, result);
		});
	}
}

exports.createBar = createBar;

function readBar(bar, callback) {
	var filters = {
		exchangeId: bar.exchangeId,
		symbolName: bar.symbolName,
		dateTime: bar.dateTime
	};
	Bar.findOne(filters, function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
}

exports.readBar = readBar;

function getAllBarsBySymbol(symbolName, callback) {
	var filters = {
		symbolName: symbolName
	};
	Bar.find(filters).sort({timestamp: 'asc'}).exec(function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
}

exports.getAllBarsBySymbol = getAllBarsBySymbol;

function getSymbolOnDay(exchangeId, symbolName, day, callback) {

	day = util.getMostRecentMidnight(day);
	var nextDay = util.getNextDay(day);
	var filters = {
		"symbolName": symbolName,
		"exchangeId": exchangeId,
		"dateTime": {$gte: day, $lt: nextDay}
		
	};
	if (exchangeId === 2) {
		filters.type = "OHLC";
	}
	Bar.find(filters).sort({dateTime: 'asc'}).exec(function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
}

exports.getSymbolOnDay = getSymbolOnDay;


function getAllBarsByDay(exchangeId, day, callback) {

	var nextDay = util.getNextDay(day);

	var filters = {
		"symbolName": "AAPL",
		"exchangeId": exchangeId,
		"dateTime": {"$gte": day, "$lt": nextDay}
	};

	if (exchangeId === 2) {
		filters.type = "quote";
	}
	Bar.find(filters).sort({dateTime: 1}).exec(function(err, result) {
		if (err) {
			console.log('returned error');
			return callback(err);
		}

		callback(null, result);
	});
}
exports.getAllBarsByDay = getAllBarsByDay;

function getBidsAndAsksByDay(exchangeId, day, callback) {
	var nextDay = util.getNextDay(day);

	var filters = {
		
		"type": {"$ne": null}

	};

	Bar.find(filters).exec(function(err, result) {
		if (err) {
			console.log('returned error');
			return callback(err);
		}
		callback(null, result);
	});
}
exports.getBidsAndAsksByDay = getBidsAndAsksByDay;

function getOptionPrices(optionName, time, callback) {

	var filters = {
		"symbolName": optionName
	};

	Bar.find(filters).sort({dateTime: 1}).exec(function(err, result) {
		if (err) {
			console.log('returned error');
			return callback(err);
		}

		callback(null, result);
	});
}
exports.getOptionPrices = getOptionPrices;

function getMinuteBarNum(symbolName, day, minuteNum, callback) {

	var filters = {
		"symbolName": symbolName,
		"dateTime": util.minuteNumToTime(minuteNum, day)
	};

	Bar.find(filters).exec(function(err, result) {
		if (err) {
			console.log('returned error');
			return callback(err);
		}

		callback(null, result);
	});
}
exports.getMinuteBarNum = getMinuteBarNum;


var barSchema = mongoose.Schema({
	reportedExchange: String,
	type: String,
	exchangeId: Number,
	symbolName: String,
	dateTime: Date,
	timestamp: Number,
	open: Number,
	high: Number,
	low: Number,
	close: Number,
	last: Number,
	ask: Number,
	bid: Number,
	volume: Number
});

var Bar = mongoose.model('Bar', barSchema);
