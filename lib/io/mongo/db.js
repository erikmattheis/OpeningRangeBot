"use strict";

var mongoose = require('mongoose');

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
		exchangeId: bar.exchangeId,
		symbolName: bar.symbolName,
		timestamp: bar.timestamp,
		/*open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,*/
		last: bar.last,
		volume: bar.volume
	});

			bar.save(function(err, result) {
				//callback("recorded " +  bar);
				if (err) return console.error(err);
				callback(null, result);
			});

	/* TODO: only check if importing from minute CSV */
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

exports.createBar = createBar;

function readBar(bar, callback) {
	var filters = {
		exchangeId: bar.exchangeId,
		symbolName: bar.symbolName,
		timestamp: bar.timestamp
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
	Bar.find(filters).sort({dateTime: 'asc'}).exec(function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
}

exports.getAllBarsBySymbol = getAllBarsBySymbol;


var barSchema = mongoose.Schema({
	exchangeId: Number,
	symbolName: String,
	dateTime: Date,
	timestamp: Number,
	open: Number,
	high: Number,
	low: Number,
	close: Number,
	last: Number,
	volume: Number
});

var Bar = mongoose.model('Bar', barSchema);
