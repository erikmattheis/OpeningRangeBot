"use strict";

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
				emitter.on("data", function(data) {					
					expect(data).to.have.property("status", "connected");
				});
				
				done();
			});
		});
	});
});
