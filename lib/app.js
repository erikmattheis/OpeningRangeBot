"use strict";

var async = require("async"),
	config = require("./config/config.json"),
	stream = require("./io/exchange/TradeKing/stream.js"),
	orders = require("./io/exchange/TradeKing/orders.js"),
	db = require("./io/mongo/db.js"),
	csvData = require("./io/csv/csv-data.js"),
	simulator = require("./io/simulator/simulator.js"),
	trader = require("./trader/trader.js"),
	server = require("./io/server/server.js");

orders.getOrders();

if (config.streamSource === "FILE") {
	trader = require("./trader/ohlcTrader2.js");
}
if (config.simulateTicks === true) {
	simulator = require("./io/simulator/tickSimulator.js");
	trader = require("./trader/tickTrader.js");
}
if (config.simulateOptionsStrategy) {
	trader = require("./trader/optionsStrategyTrader3.js");
}

//server.start(trader);

var CronJob = require('cron').CronJob,
util = require("./util/util.js");

var start, end;

function setStartAndStopTimes() {
	start = util.pad2(new Date().getSeconds() + 1) + ' ' + util.pad2(new Date().getMinutes()) + ' ' + util.pad2(new Date().getHours());
	end = util.pad2(new Date().getSeconds() + 11) + ' ' + util.pad2(new Date().getMinutes()) + ' ' + util.pad2(new Date().getHours());
	start = start + ' * * 1-5';
	end = end + ' * * 1-5';

	var starting = new CronJob({
	  cronTime: start,
	  onTick: function() {
	    init();
	  },
	  start: false,
	  timeZone: 'America/Chicago'
	});
	starting.start();

	var sleeping = new CronJob({
	  cronTime: end,
	  onTick: function() {
	    sleep()
	  },
	  start: false,
	  timeZone: 'America/Chicago'
	});
	sleeping.start();

	setTimeout(function() {
		setStartAndStopTimes();
	}, 15000);
}

//setStartAndStopTimes();

// start = '00 59 07 * * 1-5';
// end = '00 30 15 * * 1-5';

// TODO: bank holidays





function sleep() {

	stream.destroy();
	
}

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

//init()

function startStream(callback) {

	if (config.simulateOptionsStrategy) {
		trader.Trader(null, null);
		trader.start();
		
		//trader.straddle("IWM", new Date(2015, 1, 13, 8, 35));
	}
	else if (config.streamSource === "TradeKing") {

		stream.init(["IWM", "SPY", "QQQ", "DIA", "AAPL", "FB"], config.recordOptions, function(err, emitter, broker) {

			if (err) return console.log("error:", err);

			if (!trader.broker) {
				trader.Trader(emitter, broker);
			}
			
			// TODO better way to do this?
			if (emitter.listeners('data').indexOf("[Function: recordData]")) {
				emitter.on("data", recordData);
			}
			
			callback(null);

		});
	}
	else if (config.streamSource === "TradeKingSavedData") {
		
		startSimulation(2);

	}
	else if (config.streamSource === "FILE") {

		if (config.checkForNewData) {

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
						startSimulation(1);
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

		else {
			startSimulation(1);
		}

	}
}

function startSimulation(exchangeId, date) {
	if (config.runSimulation === true) {
		simulator.init(exchangeId, function(err, emitter, broker) {
			if (err) return console.log("error:", err);
			trader.Trader(emitter, broker);
			simulator.simulateDates(new Date(2015, 0, 1), new Date(2015, 5, 1), 1);
		});
	}
}

var num = 0;

function recordData(bar, callback) {

	if (!bar.symbolName
		|| bar.status) {
		console.log(bar)
		console.log("this is not a bar");
		return;
	}

	db.createBar(bar, function(err, result) {
		if (err) {
			console.log('error saving bar: ', err);
			if (callback) {
				callback(null);
			}
		}
		else if (result.dateTime) {
			console.log("recorded ", result.symbolName, " bar. #", num++, " at ", result.dateTime.getHours(), ":", result.dateTime.getMinutes(), result.dtimestamp, result.type, result.reportedExchange);
			if (callback) {
				callback(null);
			}
		}
		else {
			console.log("Result did not contain dateTime");
		}
	});
}
