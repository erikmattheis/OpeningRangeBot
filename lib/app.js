"use strict";

var async = require("async"),
	config = require("./config/config.json"),
	stream = require("./io/exchange/TradeKing/stream.js"),
	db = require("./io/mongo/db.js"),
	csvData = require("./io/csv/csv-data.js"),
	simulator = require("./io/simulator/simulator.js"),
	trader = require("./trader/trader.js");

function init() {

	async.series([
		function(callback) {
			db.init(function(err, connected) {
				if (err) callback(err);
				callback();
			});
		},
		function(callback) {
			startStream(function(err) {
				if (err) callback(err);
				callback();
			});
		},
		function(err, result) {
			if (err) return console.log.bind("error:", err);
		}]);
}

function startStream(callback) {
	if (config.streamSource === "TradeKing") {
		stream.init(["IWM", "SPY", "AAPL", "QQQ", "DIA", "FB"], function(err, emitter, broker) {

			if (err) return console.log("error:", err);

			trader.Trader(emitter, broker);

			emitter.on("data", recordData);
			
			callback(null);

		});
	}
	else if (config.streamSource === "TradeKingSavedData") {
		
		simulator.init(function(err, emitter, broker) {
			if (err) return console.log("error:", err);
			trader.Trader(emitter, broker);
			simulator.simulateDates(new Date(2015, 3, 7), new Date(2015, 5, 5));
		});

	}
	else if (config.streamSource === "FILE") {

		csvData.init(function(err, result) {

			if (err) return console.log("error:", err);

			async.eachLimit(result, 1, function(bar, callback) {

				recordData(bar, function(err, result) {
					// TODO: Make sure we don't care about any possible error
					callback();
				});

			},
			function(err){
				if( err ) {
					console.log('An error occurred!');
				}
				else {
					console.log('All bars have been recorded');
					callback();
				}
			});

			/*
			csvData.initializeStream(function(err, emmiter) {
				emmiter.on("update", observe);
				csvData.tick(emmiter, ["IWM"], new Date(2014, 11, 16), new Date(2015, 3, 2));
			});
*/

		});
	}
}
var num = 0;

function recordData(bar, callback) {

	if (!bar.symbolName) {
		return;
	}

	db.createBar(bar, function(err, result) {
		if (err) return console.log('error saving bar: ', err);
		console.log("recorded ", result.symbolName, " bar. #", num++);
		if (callback) {
			callback(null);
		}
	});
}

init();