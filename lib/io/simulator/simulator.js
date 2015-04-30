var async = require("async"),
	db = require("../mongo/db.js");

function getDaysData(day) {
	console.log("getting documents for ", day.toString());
	db.getAllBarsByDay(day, function(err, result) {
		if (err) {
			return console.log("error:", err);
		}
		console.log("number of documents retrieved: ", result.length);
	});
	setTimeout(console.log, 200000)
}

db.init(function(err) {
	getDaysData(new Date(2015, 3, 29));
}) 
