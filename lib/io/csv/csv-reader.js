"use strict";

var fs = require('fs'),
	async = require('async'),
	parseCSV = require('csv-parse');

function getFileNames(callback) {
	fs.readdir('csv', function(err, fileNames) {
		if (err) {
			callback(err);
			return;
		}
		callback(null, fileNames);
	});
}

exports.getFileNames = getFileNames;

function readCSV(fileName, callback) {
	fs.readFile('csv/' + fileName, function(err, result) {
		if (err) {
			callback(err);
		}
		parseCSV(result, { delimiter: ',', trim: true }, function(err, output) {
			// remove header columns [ 'Date', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume' ],
			output.shift();
			callback(null, output);
		});
	});
}

exports.readCSV = readCSV;