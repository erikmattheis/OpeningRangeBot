'use strict';

var myapp = angular.module('myapp', []);

myapp.controller('myctrl', function ($scope, $http, $q) {

$scope.exchangeId = 1;
   $scope.selectedDay = new Date(2015,4,1);
   $scope.symbols = ["IWM", "SPY", "AAPL", "FB"];
   $scope.selectedSymbol = $scope.symbols[0];
   $scope.getDataForSymbolAndDay = function() {
    var url = "/data"
        + "/" + $scope.exchangeId
        + "/" + $scope.selectedSymbol
        + "/" + new Date($scope.selectedDay).toISOString();;
    makeRequest(url);
   }

   function makeRequest(url) {
        var request = $http({
            method: "get",
            url: url
        });
        return( request.then( handleSuccess, handleError ) );
    }

   function handleError(response) {

        if (!angular.isObject(response.data)
            || !response.data.message) {

            return($q.reject( "An unknown error occurred." ));

        }
        return($q.reject(response.data.message));

    }

    function handleSuccess( response ) {
        console.log("OK");
        var chart = new Highcharts.Chart({
            chart: {
                renderTo: 'container'
            },
            
            series: [{
                type: 'ohlc',
                data: response.data.ohlc    
            },
            {
            type : 'flags',
                data : response.data.flags
        });

    }

});