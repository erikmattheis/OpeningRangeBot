var expect = require("chai").expect,
	csvData = require("../../../lib/io/csv/csv-data.js");

describe("io/csv/csv-data.js", function() {
	describe("#init()", function() {
		it("Should return object with expected properties", function(done) {
			
			csvData.read(function(err, bars) {
				if (err) {
					console.log(err);
				}
				
				expect(bars[0][0]).to.have.property("symbolName");
				expect(bars[0][0]).to.have.property("dateTime");
				expect(bars[0][0]).to.have.property("open");
				expect(bars[0][0]).to.have.property("high");
				expect(bars[0][0]).to.have.property("low");
				expect(bars[0][0]).to.have.property("close");
				expect(bars[0][0]).to.have.property("volume");
				done();
			});
			
		});
	});
});