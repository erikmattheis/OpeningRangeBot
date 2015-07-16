
"use strict";
var logger = require('../log/logger.js'),
	finance = require('../util/finance.js'),
	util = require('../util/util.js');

var config = {
	numOpeningMinutes: 1,
	riskFactor: .5,
	shyFactor: 1,
	requireDirectionCheck: true,
	thinkOutLoud: true,
	maxLoss: .1,
	useMaxLoss: false
}

var emitter, broker, openingRange, symbols, previousMinuteData, previousTodayString, cachedResults;

function Trader(emitter, broker) {

	checkConfig();

	if (broker) {
		this.broker = broker;
	}
	if (emitter) {
		this.emitter = emitter;
		this.emitter.on("data", think);
	}
	
	openingRange = [];
	symbols = [];
	previousMinuteData = [];
	cachedResults = [];

}

exports.Trader = Trader;

function checkConfig() {
	if (config.numOpeningMinutes < 1) {
		throw new Error("numOpeningMinutes must be greater than zero.")
	}
}

function think(data, callback) {
	console.log(data);
}