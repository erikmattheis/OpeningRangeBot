"use strict";

var config = require("./config/config.json"),
	stream = require("./io/exchange/TradeKing/stream.js");

function init() {
	if (config.streamSource === "TradeKing") {
		stream.init(["IWM","AAPL","SPY","FB"], function(err, result) {
			if (err) return console.log('error:', err);

		});
	}
/*
	if (config.streamSource === "FILE") {
		csvData.init(function(err, result) {
			if (err) return console.log('error:', err);

			csvData.initializeStream(function(err, emmiter) {
				emmiter.on("update", observe);
				csvData.tick(emmiter, ["IWM"], new Date(2014, 11, 16), new Date(2015, 3, 2));
			});

		});
	}
*/
}

init();