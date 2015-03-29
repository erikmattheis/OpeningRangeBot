"use strict";

var async = require("async"),
	csvReader = require("./csv-reader.js");

function read(callback) {

	async.waterfall(
		[
			/* get a list of files in the csv directory */
			function(callback) {
				csvReader.getFileNames(function(err, result) {
					if (err) {
						return callback(err);
					}
					callback(null, result);
				});
				
			},

			function(fileNames, callback) {

				async.map(fileNames,
					function(fileName, callback) {
						
						csvReader.readCSV(fileName, function(err, result) {
							if (err) {
								return callback(err);
							}

							var formattedResult = result.map(function(bar) {
								return {
									// convention is [symbolName]-[mm/dd/yyy].csv or [option name].csv
									symbolName: fileName.split("-")[0].split(".csv")[0].toUpperCase(),
									dateTime: new Date(bar[0] + " " + bar[1]),
									open: bar[2],
									high: bar[3],
									low: bar[4],
									close: bar[5],
									volume: bar[6]
								}
							});
							callback(null, formattedResult);
						});
						
					},
					function(err, result) {

						if (err) {
							return callback(err);
						}

						callback(null, result);
					}
				);
			}

		],
		function (err, result) {
			if (err) {
				return callback(err);
			}
			callback(null, result);
		}
	);
}

exports.read = read;