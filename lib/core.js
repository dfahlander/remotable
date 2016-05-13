
/** A method registry where all decorated methods are put
 * so that they can be found when acting as server.
 */
var registry = {};

/** Anonymous callbacks identity counter */
var nextFunctionId = 1;

/** Unique identifier for each request */
var counter = 0;

/** Outstanding Requests awaiting responses */
var reqs = {};

var replacers = [],
    revivers = {};
// Replacers signature: replace (value). Returns falsy if not replacing. Otherwise ["Date", value.getTime()]
// Revivers: map {type => reviver}. Sample: {"Date": value => new Date(value)}

var proxies = [];

module.exports = function remotable (options) {
    var opts = options;
    if (arguments.length > 2 && typeof arguments[0] === 'object' && typeof arguments[1] === 'string' && typeof arguments[2] === 'object') {
        // Allow @remotable without ()
        opts = null;
        return decorate.apply(null, arguments);
    }
    if (arguments.length === 2 && typeof arguments[0] === 'object' && typeof arguments[1] === 'function') {
        // Allow ES5 code to do var func = remotable ({options}, function(...){...});
        return decorate({name: "__function__"}, arguments[1].name, {value: arguments[1]}).value;
    }
    // Standard: @remotable(options):
    return decorate;
    
    function decorate (target, key, descriptor) {
        var func = descriptor.value || descriptor.get.apply(target);
            methodId = opts.id || (target.name + "." + key);
        
        registry[methodId] = proxy;
        
        return {
            value: proxy,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
            writable: descriptor.writable
        };
        
        function proxy() {
            var channelingFn = onproxy (methodId, opts, target, key, descriptor);
            if (!channelingFn) return func.apply(this, arguments); // Run locally
            // Else proxy it:
            var i = arguments.length,
                args = new Array(i);
            while (i--) args[i] = arguments[i];
            return serialize("call", methodId, [this, args], channelingFn);
        }
    };
}

function serialize (op, methodId, data, channelingFn) {
    return new Promise((resolve, reject) => {
        var reqId = ++counter;
        channelingFn(stringify({
            id: reqId,
            op: op,
            method: methodId,
            data: data
        }, channelingFn));
        reqs[reqId] = {resolve, reject};
    });
}

function respondTo(msg, backchannel) {
    var op = msg.op,
        id = msg.id,
        methodId = msg.method,
        data = msg.data;
    switch(op) {
        case 'call': {
            let meth = registry[methodId];
            if (meth) {
                meth.apply(data[0], data[1]).then(result => {
                    backchannel({op: "res", id: id, data: result});
                }).catch(error => {
                    backchannel({op: "rej", id: id, data: error});
                });
            } else {
                backchannel({op: "rej", id: id, data: new Error(`Method unknown: ${methodId}`)});
            }
            break;
        }
        case 'res':
        case 'rej': {
            let req = reqs[id];
            if (!req) return;
            req[op === 'res' ? 0 : 1](val);
            delete reqs[id];
            break;
        }
    }
}

remotable.handle = (text, backchannel) => {
    respondTo (parse(text), msg => backchannel(stringify(msg, backchannel)));
}

remotable.decide = p => proxies.push(p);

function onproxy (methodId, options, target, key, descriptor) => {
    var i = proxies.length;
    while (i--) {
        var rv = proxies[i](methodId, options, target, key, descriptor);
        if (rv) return rv;
    }
};

function stringify (obj, channel) {
    var types = {};
    return JSON.stringify(obj, (key, value) => {
        var i = replacers.length;
        while (i--) {
            var replacement = replacers[i](value);
            if (replacement) {
                types[key] = replacement[0]; // replacement[0] = Type Identifyer
                return replacement[1];
            }
        }
        return value;
    });
}

function parse (text) {
    var types = JSON.parse(text).types; // I'm sorry we need to call JSON.parse twice. Could be optimized.
    return JSON.parse(text, (key, value) => {
        var type = types[key];
        var reviver = type && revivers[type];
        if (reviver) return reviver (value);
        return value;
    }
}

remotable.registerType = function (typeId, test, replace, revive) {
    replacers.push (value => test(value) && [typeId, replace(value)]);
    revivers[typeId] = revive;
}
