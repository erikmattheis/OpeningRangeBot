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
					//callback("recorded " +  bar);
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
		timestamp: bar.dateTime
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

function getSymbolOnDay(symbolName, day, callback) {

	day = util.getMostRecentMidnight(day);
	var nextDay = util.getNextDay(day);
console.log("looking for records between", day, "and", nextDay);
	var filters = {
		"type": "OHLC",
		"symbolName": symbolName,
		"exchangeId": 2,
		"dateTime": {"$gte": day, "$lt": nextDay}
	};
	Bar.find(filters).sort({timestamp: 'asc'}).exec(function(err, result) {
		if (err) return callback(err);
		console.log("found", result.length, "records");
		callback(null, result);
	});
}

exports.getSymbolOnDay = getSymbolOnDay;

function getAllBarsByDay(exchangeId, day, callback) {

	var nextDay = util.getNextDay(day);

	var filters = {
		"exchangeId": exchangeId,
		"symbolName": "IWM",
		"dateTime": {"$gte": day, "$lt": nextDay}
	};

	if (exchangeId === 2) {
		filters.type = "quote";
	}
console.log(filters)
	Bar.find(filters).sort({dateTime: 'asc'}).exec(function(err, result) {
		if (err) {
			console.log('returned error');
			return callback(err);
		}

		callback(null, result);
	});
}

exports.getAllBarsByDay = getAllBarsByDay;


var barSchema = mongoose.Schema({
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
