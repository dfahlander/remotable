
var remotable = require('./core');
module.exports = remotable;

var roles = {};

remotable.registerType (
    "Date",
    value => value instanceof Date,
    value => value.getTime(),
    value => new Date(value));

remotable.registerType (
    "Error",
    value => value instanceof Error,
    value => ({name: e.name, message: e.message}),
    value => {
        var e = new Error(value.message);
        e.name = value.name;
        return e;
    }
)

remotable.configure = configuration => {
    Object.keys(configuration.roles).forEach(role => roles[role] = configuration.roles[role]);
}

remotable.decide ((target, key, descriptor, options) => {
   if (options.runat) {
       var role = roles[options.runat];
       if (role) return role;
   }
});

 
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
