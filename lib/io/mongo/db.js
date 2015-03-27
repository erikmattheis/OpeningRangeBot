var mongoose = require('mongoose');

function init(callback) {

	mongoose.connect('mongodb://localhost/OpeningRangeBot');

	var db = mongoose.connection;

	db.on('error', console.error.bind(console, 'connection error:'));

	db.once('open', function () {
		callback(null, true);
	});
}

exports.init = init;

function createBar(bar, callback) {
	console.log(bar)
	var bar = new Bar({
		exchange: bar.exchange,
		symbolName: bar.symbolName,
		dateTime: bar.dateTime,
		open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,
		last: bar.last,
		volume: bar.volume
	});
	readBar(bar, function(err, result) {
		if (!result) {
			//console.log("! ", result);
			bar.save(function(err, result) {
				console.log("wtf", bar.exchange)
				if (err) return console.error(err);
				callback(null, result);
			});
		}
		else {
			callback("Similar bar exists " +  bar.exchange);
		}

	})

}

exports.createBar = createBar;

function readBar(bar, callback) {
	var filters = {
		exchangeId: bar.exchangeId,
		symbolName: bar.symbolName,
		dateTime: bar.dateTime
	};
	Bar.find(filters, function(err, result) {
		if (err) return console.error(err);
		callback(null, result);
	});
}

exports.readBar = readBar;

var barSchema = mongoose.Schema({
	exchangeId: Number,
	symbolName: String,
	dateTime: Date,
	open: Number,
	high: Number,
	low: Number,
	close: Number,
	last: Number,
	volume: Number
});

var Bar = mongoose.model('Bar', barSchema);
