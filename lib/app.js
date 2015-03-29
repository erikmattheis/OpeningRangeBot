"use strict";

var async = require("async"),
	config = require("./config/config.json"),
	stream = require("./io/exchange/TradeKing/stream.js"),
	db = require("./io/mongo/db.js");

function init() {

	async.series([
		function(callback) {
			db.init(function(err, connected) {
				if (err) callback(err);
				callback();
			});
		},
		function(callback) {
			startStream(function(err, connected) {
				if (err) callback(err);
				callback();
			});
		},
		function(err, result) {
			if (err) return console.error.bind("error:", err);
		}]);
}

function startStream(callback) {
	if (config.streamSource === "TradeKing") {
		stream.init(["IWM", "AAPL", "SPY", "FB"], function(err, emitter) {

			if (err) return console.log("error:", err);

			emitter.on("data", recordData);
			
			callback(null);

		});
	}

/*
	if (config.streamSource === "FILE") {
		csvData.init(function(err, result) {
			if (err) return console.log("error:", err);

			csvData.initializeStream(function(err, emmiter) {
				emmiter.on("update", observe);
				csvData.tick(emmiter, ["IWM"], new Date(2014, 11, 16), new Date(2015, 3, 2));
			});

		});
	}
*/
}

function recordData(bar) {

	db.createBar(bar, function(err, result) {
		
		if (err) return console.log("error:", err);
		console.log("recorded ", result.symbol, " bar");
	});
}

init();