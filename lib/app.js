"use strict";
/*

var db = require("./io/mongo/db.js");
var config = require("./config/config.json");

function init() {
	console.log(config.streamSource);

	if (config.streamSource === "FILE") {
		csvData.init(function(err, result) {
			if (err) return console.log('error:', err);

			csvData.initializeStream(function(err, emmiter) {
				emmiter.on("update", observe);
				csvData.tick(emmiter, ["IWM"], new Date(2014, 11, 16), new Date(2015, 3, 2));
			});

		});
	}

}

init();
*/