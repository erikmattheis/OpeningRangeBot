var expect = require("chai").expect,
	EventEmitter = require('events').EventEmitter,
	stream = require("../../../../lib/io/exchange/TradeKing/stream.js");

describe("lib/io/exchange/TradeKing/stream.js", function() {
	describe("#init()", function() {
		it("Should connect to TradeKing stream without error", function(done) {
			
			stream.init(["IWM"], function(err, emitter) {
				if (err) {
					console.log(err);
				}
				stream.getEmitter().on("data", function(data) {
					//console.log("event", data);
					
					expect(data).to.have.property("status", "connected");
				});
				
				done();
			});
		});
		/*
		it("Should return object with expected properties", function(done) {
			
			stream.stream(function(err, bars) {
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
*/
	});
});
