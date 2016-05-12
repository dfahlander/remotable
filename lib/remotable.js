
export default function Remotable() {
    var i = arguments.length,
        args = new Array(i);
    while (i--) args[i] = arguments[i];
    return (target, key, descriptor) => {
        var func = descriptor.value;
        return {
            value: proxy,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
            writable: descriptor.writable
        };
        function proxy() {
            var channelingFn = Remotable.onproxy.bind(target, key, func)(args);
            if (!channelingFn) return func.apply(this, arguments);
            var i = arguments.length,
                args2 = new Array(i);
            while (i--) args2[i] = arguments[i];
            
            return serialize("call", target.name, key || func.name, args2, channelingFn);
        }
    };
}

var counter = 0;
var reqs = {};

function serialize (op, _class, _function, args, channelingFn) {
    return new Promise((resolve, reject) => {
        var reqId = ++counter;
        channelingFn(JSON.serialize({
            id: reqId,
            op: op,
            target: _class ? _class + '.' + _function : _function,
            args: args
        }));
        reqs[reqId] = [resolve, reject];
    });
}

function respondTo(msg) {
    var op = msg[0],
        val = msg[1];
    switch(op) {
        case 'res':
        case 'rej':
            let req = reqs[msg.reqId];
            if (!req) return;
            req[op === 'res' ? 0 : 1](val);
            delete reqs[msg.reqId];
            break;
    }
}

Remotable.handle = text => {
    respondTo(JSON.parse(text));
}

Remotable.onproxy = ()=>{};

