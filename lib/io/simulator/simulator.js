var db = require("../mongo/db.js")
	Emitter = require('events').EventEmitter;

var emitter = new Emitter();

function init(day, callback) {

	console.log("getting documents for ", day.toString());
	db.getAllBarsByDay(day, function(err, result) {
		if (err) {
			return console.log("error:", err);
		}
		console.log("number of documents retrieved: ", result.length);
		callback(null, emitter);
		simulate(result);
	});

}

exports.init = init;

function simulate(documents) {
	console.log("simulating ", documents.length);
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