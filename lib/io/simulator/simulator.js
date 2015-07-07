var db = require("../mongo/db.js")
	Emitter = require('events').EventEmitter,
	util = require('../../util/util.js');

var emitter = new Emitter();
var exchangeId;

exports.simulated = true;

function init(e, callback) {

	exchangeId = e;
	callback(null, emitter, exports);

}

exports.init = init;

function validateData(data) {
	if (!data.length) {
		return;
	}
	/* TODO: account for days when market closes early */

	var hasOpeningMinutreBar = false;
	var hasClosingMinutreBar = false;
	/*
	var hasOpeningMinutreBar = data.find(function(bar) {
		return bar.dateTime.getHours() === 8 && bar.dateTime.getMinutes() === 30;
	});
	var hasClosingMinutreBar = data.find(function(bar) {
		return bar.dateTime.getHours() === 15 && bar.dateTime.getMinutes() === 0;
	});
	*/
	for (var i = 0; i < data.length; i++) {
		if (data[i].dateTime.getHours() === 8 && data[i].dateTime.getMinutes() === 30) {
			hasOpeningMinutreBar = true;
			break;
		}
	}
	/*
	for (i = data.length - 1; i > -1; i--) {
		if (isLastMinute(data[i])) {
			hasClosingMinutreBar = true;
			console.log('found closing');
			break;
		}
	}
	console.log('data.length ', data.length)
	console.log(data[data.length - 1].dateTime.getHours())
	*/
	return hasOpeningMinutreBar; // && hasClosingMinutreBar;
}

function isLastMinute(bar) {
	return true; //bar.dateTime.getHours() === 15;
}

function simulate(documents, callback) {
	console.log("simulating ", documents.length, " trades");
	for (var i = 0; i < documents.length; i++) {
		if (i === documents.length - 1) {
			emitter.emit("data", {end:true});
			callback(null);
			break;
		}
		emitter.emit("data", {
			type: documents[i].type,
			symbolName: documents[i].symbolName,
			exchangeId: documents[i].exchangeId,
			dateTime: documents[i].dateTime,
			timestamp: documents[i].timestamp,
			open: documents[i].open,
			high: documents[i].high,
			low: documents[i].low,
			close: documents[i].close,
			ask: documents[i].ask,
			bid: documents[i].bid,
			volume: documents[i].volume
		});
	}
}

function buyOptions(trade, callback) {
	trade.optionName = trade.symbol;
	trade.optionEntryPrice = trade.entry - Math.floor(trade.entry);
	callback(null, trade)
}

exports.buyOptions = buyOptions;

function sellOptions(trade, callback) {
	callback(null, trade);
}

exports.sellOptions = sellOptions;

function simulateDates(from, to) {
	var day = from;
	while (day.getDay() === 6 || day.getDay === 0) {
		day = util.getNextDay(day);
	}
	if (from <= to) {
		simulateDay(day, function(err) {
			if (err) return console.log("simulate error", err);
			simulateDates(util.getNextDay(day), to);
		});
	}
	else {
		console.log('simulation complete');
	}

}

exports.simulateDates = simulateDates;

function simulateDay(day, callback) {

	db.getAllBarsByDay(exchangeId, day, function(err, result) {
		if (err) {
			return console.log("error:", err);
		}
		console.log(day.toString(), "retrieved docs: ", result.length);

		if (!validateData(result)) {
			console.log("Data did not validate for " + day.getFullYear() + '/' + day.getMonth() + '/' + day.getDate());
			callback(null);
		}
		else {
			simulate(result, callback);
		}
	});
}
exports.simulateDay = simulateDay;
