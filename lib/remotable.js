
var remotable = require('./remotable-core');
module.exports = remotable;

// Register some built-in types
remotable.registerType (
    "Date",
    function(value) {return value instanceof Date;},
    function(value) {return value.getTime();},
    function(value) {return new Date(value);});
    
function registerError(name, constructor) {
    remotable.registerType (
        name,
        function(value) {return value instanceof constructor;},
        function(value) {return {name: value.name, message: value.message};},
        function(value) {
            var e = new constructor(value.message);
            e.name = value.name;
            return e;
        }
    );
}

registerError("Error", Error);
registerError("TypeError", TypeError);
registerError("SyntaxError", SyntaxError);

 
/* Below snippe would work, but would generate a leak for each serialized function:

remotable.registerType (
    "Function",
    value => typeof value === 'function',
    value => {
        var id = nextFunctionId++;
        registry["_anonymous_" + id] = value;
        return id;
    },
    (value, channel) => function() {
        var i = arguments.length,
            args = new Array(i);
        while (i--) args[i] = arguments[i];        
        return serialize("call", "_anonymous_" + value, [this, args], channel);
    }
)
*/
