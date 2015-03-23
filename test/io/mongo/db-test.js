var expect = require("chai").expect,
	db = require("../../../lib/io/mongo/db.js");

describe("io/mongo/db.js", function() {
	describe("#init()", function() {
		it("Should init without an error", function(done) {
			
			db.init(function(err, result) {
				if (err) {
					console.log('test error:', err);
				}
				expect(result).ok;
				done();

			});
		});
	});

	describe("#createBar()", function() {
		it("Should create record without an error", function(done) {
			var bar = {
				symbolName: "test",
				dateTime: new Date(1976, 6, 4),
				open: 0,
				high: 0,
				low: 0,
				close: 0,
				volume: 0
			};
			db.createBar(bar, function(result) {
				done();
			});
		});
		it("Should retrieve record without an error", function(done) {
			var bar = {
				symbolName: "test",
				dateTime: new Date(1976, 6, 4)
			};
			db.readBar(bar, function(err, result) {
				if (err) return console.error(err);
				console.log("result is", result)
				done();
			});
		});
	});
});
