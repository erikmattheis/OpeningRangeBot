var db = require("../mongo/db.js")
	Emitter = require('events').EventEmitter;

var emitter = new Emitter();

exports.simulated = true;

function init(day, callback) {

	console.log("getting documents for ", day.toString());
	db.getAllBarsByDay(day, function(err, result) {
		if (err) {
			return console.log("error:", err);
		}
		console.log("number of documents retrieved: ", result.length);

		if (!validateData(result)) {
			callback("Data did not validate.");
		}
		else {
			callback(err, emitter, exports);
			simulate(result);
		}
		
	});

}

exports.init = init;

function validateData(data) {
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
			console.log('found opening')
			break;
		}
	}
	for (i = data.length - 1; i > -1; i--) {
		if (data[i].dateTime.getHours() === 15 && data[i].dateTime.getMinutes() === 0) {
			hasClosingMinutreBar = true;
			console.log('found closing')
			break;
		}
	}
	return hasOpeningMinutreBar && hasClosingMinutreBar;
}

function simulate(documents) {
	console.log("simulating ", documents.length, " trades");
	for (var i = 0; i < documents.length; i++) {
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