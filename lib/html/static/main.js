'use strict';

var myapp = angular.module('myapp', ['angular-loading-bar']);

myapp.controller('myctrl', function ($scope, $http, $q) {

   $scope.exchangeId = 1;
   $scope.selectedDay = new Date(2015,4,1);
   $scope.symbols = ["IWM", "SPY", "AAPL", "FB"];
   $scope.selectedSymbol = $scope.symbols[0];

   $scope.getDataForSymbolAndDay = function() {
        var url = "/data"
            + "/" + $scope.exchangeId
            + "/" + $scope.selectedSymbol
            + "/" + new Date($scope.selectedDay).toISOString();
        makeRequest(url, handleSymbolSucess);
    }

    $scope.getAvailableOptionNames = function() {
        var url = "/option-names"
            + "/" + $scope.selectedSymbol
            + "/" + new Date($scope.selectedDay).toISOString();
        makeRequest(url, populateOptionsSelectBox);      
    }

    $scope.getOptionPrices = function() {
        var url = "/data"
            + "/" + $scope.exchangeId
            + "/" + $scope.selectedOption
            + "/" + new Date($scope.selectedDay).toISOString();
        makeRequest(url, handleOptionSucess);
    }

    $scope.getStraddlePrices= function() {
        var url = "/straddle"
            + "/" + $scope.selectedSymbol
            + "/" + new Date($scope.selectedDay).toISOString();
        makeRequest(url, handleStraddleSucess);
    }

    function makeRequest(url, callback) {
        callback = !callback ? handleSuccess : callback;
        var request = $http({
            method: "get",
            url: url
        });
        return( request.then( callback, handleError ) );
    }

   function handleError(response) {

        if (!angular.isObject(response.data)
            || !response.data.message) {

            return($q.reject( "An unknown error occurred." ));

        }
        return($q.reject(response.data.message));

    }

    function handleSymbolSucess(response) {
        var chart = $('#container').highcharts();
        chart.series[0].setData(response.data, true); 
    }

    function handleOptionSucess(response) {
        var chart = $('#container').highcharts();
        chart.series[1].setData(response.data, true); 
    }

    function handleStraddleSucess(response) {
        var chart = $('#container').highcharts();
        chart.series[2].setData(response.data, true); 
    }

    function handleTradesSucess(response) {
        var chart = $('#container').highcharts();
        chart.series[3].setData(response.data, true); 
    }

    function populateOptionsSelectBox(optionNames) {
        $scope.optionNames = optionNames.data;
    }

    var seriesArrays = [
        {type: 'candlestick',
            data: []
        },
        {type: 'candlestick',
            data: []
        },
        {type: 'candlestick',
            data: []
        },
        {type: 'scatter',
            data: []
        }];

    $(document).ready(function() {
        $('#container').highcharts({
            chart: {
                alignTicks: false
            },
            xAxis: {
                title: {
                    enabled: true,
                    text: 'Hours of the Day'
                },
                type: 'datetime',

                dateTimeLabelFormats : {
                    hour: '%I %p',
                    minute: '%I:%M %p'
                },
            },

            yAxis: [

                {
                    title: {
                        text: 'Symbol',
                        style: {
                            color: Highcharts.getOptions().colors[0]
                        }
                    },
                },

                {
                    opposite: true,
                    title: {
                        text: 'Option',
                        style: {
                            color: Highcharts.getOptions().colors[0]
                        }
                    },
                },

                {
                    title: {
                        text: 'Straddle',
                        style: {
                            color: Highcharts.getOptions().colors[0]
                        }
                    },
                },

                {
                    title: {
                        text: 'Trades',
                        style: {
                            color: Highcharts.getOptions().colors[0]
                        }
                    },
                },


        ],



            series: seriesArrays,
        
        /*
        series: [{
                type: 'candlestick',
                //data: response.data.ohlcs
                data: response.data
            }
        */
        });
    });

});