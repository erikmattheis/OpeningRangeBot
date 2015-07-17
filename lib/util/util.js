config = require('../config/config.json')

function thinkOutLoud(msg, doIt) {
	if (config.thinkOutLoud === true) {
		console.log(msg);
	}
}
exports.thinkOutLoud = thinkOutLoud;

function money(n) {
	return Math.round(n * 100)/100;
}
exports.money = money;

function getMinuteNum(dateTime) {
	return ((dateTime.getHours() - 8) * 60) + dateTime.getMinutes() - 30;
}
exports.getMinuteNum = getMinuteNum;

function minuteNumToTime(n, date) {
	var hours = 8 + Math.floor(n/60);
	var minutes = 30 + (n % 60);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}
exports.minuteNumToTime = minuteNumToTime;

function closestOptionPrice(symbolName, price) {
	return Math.round(price * [optionGranularities[symbolName]]) / optionGranularities[symbolName];
}
exports.closestOptionPrice = closestOptionPrice;

var optionGranularities = {
	"AAPL": 1,
	"IWM": 2,
	"SPY": 2,
	"FB": 1
}


function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
exports.isNumeric = isNumeric;

function pad2(n) {
	if (n > 9) {
		return n;
	}
	return "0" + n;
}
exports.pad2 = pad2;

function getOptionName(symbolName, date, price, putOrCall) {
	// AAPL1502D123.csv
	date = getNextFriday(date);
	var months = {
		"CALL" : ["A","B","C","D","E","F","G","H","I","J","K","L"],
		"PUT" : ["M","N","O","P","Q","R","S","T","U","V","W","X"]
	};
	return symbolName
		+ pad2(date.getFullYear().toString().substr(2,2))
		+ pad2(date.getDate())
		+ months[putOrCall][date.getMonth()]
		+ price;
}
exports.getOptionName = getOptionName;


function getNextFriday(date) {
    var resultDate = new Date(date.getTime());
    resultDate.setDate(date.getDate() + (7 + 5 - date.getDay()) % 7);
    return resultDate;
}

exports.getNextFriday = getNextFriday;

function getNextDay(day) {
	var nextDay = new Date(day.getTime());
	nextDay.setDate(day.getDate() + 1);
	return nextDay;
}
exports.getNextDay = getNextDay;

function getMostRecentMidnight(day) {
	var mostRecentMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate());
	return mostRecentMidnight;
}
exports.getMostRecentMidnight = getMostRecentMidnight;