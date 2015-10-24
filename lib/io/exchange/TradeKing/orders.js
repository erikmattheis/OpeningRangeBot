"use strict";

// Use the OAuth module
var oauth = require('oauth'),
async = require("async"),
config = require('../../../config/config-private.json');

// Setup key/secret for authentication and API endpoint URL
var credentials = {
	consumer_key: config.credentials.TradeKing.consumer_key,
	consumer_secret: config.credentials.TradeKing.consumer_secret,
	access_token: config.credentials.TradeKing.access_token,
	access_secret: config.credentials.TradeKing.access_secret
};

// Setup the OAuth Consumer
var tradeking_consumer = new oauth.OAuth(
  "https://developers.tradeking.com/oauth/request_token",
  "https://developers.tradeking.com/oauth/access_token",
  credentials.consumer_key,
  credentials.consumer_secret,
  "1.0",
  "http://mywebsite.com/tradeking/callback",
  "HMAC-SHA1");

// Make a request to the API endpoint
// Manually update the access token/secret as parameters.  Typically this would be done through an OAuth callback when 
// authenticating other users.
function getOrders() {
	async.series([
		function(callback) {
			if (!account) {
				getAccount(function(err, connected) {
					if (err) callback(err);
					console.log('here');
					callback();
				});
			}
			else {
				callback();
			}
		},
		function(callback) {
			console.log('um');
			makeOrdersRequest(function(err) {
				if (err) callback(err);
				callback();
			});
		},
		function(err, result) {
			if (err) return console.log.bind("error:", err);
		}]);
}
exports.getOrders = getOrders;

function makeOrdersRequest(callback) {
	console.log('making orders request');
	//https://api.tradeking.com/v1/accounts/12345678/orders.xml
	tradeking_consumer.get('https://api.tradeking.com/v1/accounts/' + accountId + '/orders.json', credentials.access_token, credentials.access_secret,
	  function(error, data, response) {
	  	var orders = JSON.parse(data);
	  	console.log(orders);
	  	for (var i in orders.response.orderstatus) {
	  		console.log(orders.response.orderstatus[i])
	  	}
	  	
	  	
	    // Parse the JSON data
	    //var orders = JSON.parse(response);
	    // Display the response
	    //console.log(orders.response);
	    callback();
	  }
	);
}



var account,
accountId;

function getAccount(callback) {
	tradeking_consumer.get('https://api.tradeking.com/v1/accounts.json', credentials.access_token, credentials.access_secret,
	  function(error, data, response) {
	    // Parse the JSON data
	    var account_data = JSON.parse(data);
	    // Display the response
	    account = account_data.response;
	    accountId = account.accounts.accountsummary.account;
	    callback();
	  }
	);
}


//https://api.tradeking.com/v1/accounts/12345678/orders.xml
