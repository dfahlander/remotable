
var registry = {};

export default function remotable(options) {
    // Allow @remotable without ()
    var opts = options;
    if (arguments.length === 3) {
        opts = null;
        return decorate.apply(null, arguments);
    }
    // Standard: @remotable(options):
    return decorate;
    
    function decorate (target, key, descriptor) {
        var func = descriptor.value,
            method = target.name + "." + key;
        
        registry[methodId] = proxy;
        
        return {
            value: proxy,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
            writable: descriptor.writable
        };
        
        function proxy() {
            var channelingFn = remotable.onproxy(target, key, func, opts);
            if (!channelingFn) return func.apply(this, arguments); // Run locally
            var i = arguments.length,
                args = new Array(i);
            while (i--) args[i] = arguments[i];
            return serialize("call", method, [this, args], channelingFn);
        }
    };
}

var counter = 0;
var reqs = {};

function serialize (op, target, data, channelingFn) {
    return new Promise((resolve, reject) => {
        var reqId = ++counter;
        channelingFn(JSON.serialize({
            id: reqId,
            op: op,
            method: target,
            data: data
        }));
        reqs[reqId] = [resolve, reject];
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
    respondTo(JSON.parse(text), msg => backchannel(JSON.stringify(msg)));
}

remotable.onproxy = ()=>{};

// TODO:
// * Have a serializers registry with replacers and revivers
// * By default, support some native types:
// * Let msg be {types: {keyPath: type}, op: op, id: id, [method: method], data: data}
// * where type could be:
// *    Date
// *    Error
// *    Observable
