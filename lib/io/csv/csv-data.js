"use strict";

var async = require("async"),
	csvReader = require("./csv-reader.js");

function init(callback) {

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

				async.mapLimit(fileNames,
					1,
					function(fileName, callback) {
						
						csvReader.readCSV(fileName, function(err, result) {
							if (err) {
								return callback(err);
							}
						console.log("reading", fileName);
							var formattedResult = result.map(function(bar) {
								return {
									exchangeId: 1,
									// convention is [symbolName]-[mm/dd/yyy].csv or [option name].csv
									symbolName: fileName.split("-")[0].split(".csv")[0].toUpperCase(),
									dateTime: new Date(bar[0] + " " + bar[1]),
									open: bar[2],
									high: bar[3],
									low: bar[4],
									close: bar[5],
									volume: bar[6]
								}
							});/*
							callback(null, formattedResult);
							*/
							setTimeout(
								function() {
									callback(null, formattedResult);
								}, 0);

						});
						
					},
					function(err, result) {

						if (err) {
							return callback(err);
						}

						callback(null, result);
					}
				);
			},
			function(arraysOfFileData, callback) {
				var oneBigArray = [];
				arraysOfFileData.forEach(function(oneFilesData) {
					oneBigArray = oneBigArray.concat(oneFilesData);
				});
				callback(null, oneBigArray);
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

exports.init = init;