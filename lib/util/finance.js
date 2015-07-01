function simpleMA(period) {
    var nums = [];
    return function(num, symbol) {
    	console.log("num", num)
        nums.push(num);
        if (nums.length > period) {
            nums.splice(0,1);
        }
        var sum = 0;
        for (var i = 0; i < nums.length; i++) {
            sum += nums[i];
        }
        var n = period;
        if (nums.length < period) {
            n = nums.length;
        }
        console.log(sum + "/" + n);
        return(sum/n);
    }
}


exports.sma5 = simpleMA(5);
