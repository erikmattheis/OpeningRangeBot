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