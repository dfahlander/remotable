import Channel from './channel';
import Promise, {setPromise} from './promise';
import registry from './registry';
import Stream from './stream';

var routers = [];
var methodIdProviders = [];

export {Channel, Stream};

export default function remotable (options) {
    var opts = options || {};
    if (arguments.length > 2 && typeof arguments[0] === 'object' && typeof arguments[1] === 'string' && typeof arguments[2] === 'object') {
        // Allow @remotable without ()
        opts = {};
        return decorate.apply(null, arguments);
    }
    if (arguments.length > 0 && typeof arguments[0] === 'function') {
        // Allow ES5 code to do var func = remotable ({options}, function(...){...});
        opts = arguments[1] || {};
        return decorate(null, arguments[0].name, {value: arguments[0]}).value;
    }
    // Standard: @remotable(options):
    return decorate;
    
    function decorate (target, key, descriptor) {
        var func = descriptor.value || descriptor.get.apply(target),
            methodId = opts.id || target ? (target.name + "." + key) : key;
        
        methodId = methodIdProviders.reduce ((id, provider) => provider(methodId, opts), methodId);
        
        registry[methodId] = proxy;
        
        return {
            value: proxy,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
            writable: descriptor.writable
        };
        
        function proxy() {
            // Copy arguments to preserve V8 optimizations
            var i = arguments.length,
                args = new Array(i);
            while (i--) args[i] = arguments[i];
            // Check where to route this call (if any)
            var channel = route (opts, methodId, func, this, args);
            if (!channel) return func.apply(this, arguments); // If no route, run it locally.
            // Forward it to route. Channel.call() returns a Promise. 
            return channel.call (methodId, this, args, true);
        }
    }
}

function route (options, methodName, func, thiz, args) {
    var i = routers.length;
    while (i--) {
        var rv = routers[i](options, methodName, func, thiz, args);
        if (rv) return rv;
    }
}

remotable.addMethodIdProvider = function (p) {
    methodIdProviders.indexOf(p) === -1 && methodIdProviders.push(p);
}

remotable.removeMethodIdProvider = function (p) {
    var pos = methodIdProviders.indexOf(p);
    pos >= 0 && methodIdProviders.splice(pos, 1);
}

remotable.onroute = function (p) {
    routers.indexOf(p) === -1 && routers.push(p);
}

remotable.offroute = function (p) {
    var pos = routers.indexOf(p);
    pos >= 0 && routers.splice(pos, 1);
}

Object.defineProperty(remotable, "Promise", {get: ()=>Promise, set: value => setPromise(value)});

