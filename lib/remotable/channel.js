import Promise from './promise';
import registry from './registry';
import Typeson from '../typeson/';
import Stream from './stream';

var counter = 0;

var typeson = new Typeson(Typeson.defaultTypes);

var current = null;

var openStreams = {};

export default function Channel(init) {
    var reqs = {},
        pseudoTasks = null,
        channel = this,
        closed = false,
        senders = [],
        closers = [];
        
    this.onsend = senders.push.bind(senders);
    this.onclose = closers.push.bind(closers);
    
    this.call = function (method, thiz, args, awaitResponse) {
        return new Promise((resolve, reject) => {
            var reqId = ++counter;
            send({
                id: reqId,
                op: "call",
                method: method,
                thiz: thiz,
                args: args,
                await: awaitResponse
            });
            if (awaitResponse)
                reqs[reqId] = {resolve: resolve, reject: reject};
            else
                resolve();
        });
    };
    
    this.handle = function (msg) {
        var id = msg.id,
            op = msg.op;
            
        if (op === 'call') {
            var meth = registry[msg.method];
            var promise = Promise.resolve().then(()=>{
                if (!meth) throw new Error("Unknown Function: " + method);
                return meth.apply(msg.thiz, msg.args);
            });
            if (msg.awaitResponse) promise.then(result => {
                send({op: "res", id: id, data: result});
            }, error => {
                send({op: "rej", id: id, data: error});
            });
            return;
        }
        var req = reqs[id];
        if (!req) return;
        if (op === 'res' || op === 'rej') {
            req[op === 'res' ? 'resolve' : 'reject'](msg.data);
            delete reqs[id];
        } else if (op === 'next') {
            req.next && req.next(req.data);
        }
    };
    
    var send = this.send = function (msg) {
        if (closed) throw new Error ("Channel closed");
        pseudoTasks = null;
        try {
            senders.forEach(s => s(msg));
        } catch (e) {
            close(e);
        }
        var pt = pseudoTasks;
        pseudoTasks = null;
        pt && pt.forEach(fn => fn(this));
    };

    var close = this.close = function (error) {
        if (closed) return;
        closed = true;
        Object.keys(reqs).forEach(reqId => {
           reqs[reqId].reject(error || new Error ("Channel closed"));
        });
        reqs = {};
        Object.keys(openStreams).forEach(streamId => {
           var streamRef = openStreams[streamId];
           if (streamRef.channel === this) {
               streamRef.unsubscibe();
               delete openStreams[streamId];
           } 
        });
        closers.forEach(close => close());
    }
    
    // Mixin Typeson's API into Channel, but set the 'current' pointer during each method call.
    Object.keys(typeson).forEach(method => {
        var origMethod = typeson[method];
        if (typeof origMethod === 'function') {
            channel[method] = function () {
                // When calling stringify or parse, make sure that configured "remotable.Stream"
                // type (highest in this file) will be able to access ongoing channel.
                current = {
                    pseudoTasks: [],
                    channel: channel
                }
                try {
                    return origMethod.apply(typeson, arguments);
                } finally {
                    current = null;
                }
                pseudoTasks = current.pseudoTasks;
            }
        }
    });
}

registry.$closeStream = function (streamId) {
    var stream = openStreams[streamId];
    if (stream) stream.unsubscibe();
    delete openStreams[streamId];
}

typeson.register({
    "remotable.Stream": [
        x => x instanceof Stream,
        stream => {
            // Encapsulation:
            var streamId = ++counter;
            current.pseudoTasks.push(channel => {
                var unsubscibe = stream.subscribe(value => channel.send({
                    id: streamId,
                    op: "next",
                    data: value
                }), error => channel.send({
                    id: streamId,
                    op: "rej",
                    data: error
                }), ()=> channel.send({
                    id: streamId,
                    op: "res"
                }));
                // Associate streamId with the channel and the unsubscibe function.
                openStreams[streamId] = {
                    channel: channel,
                    unsubscibe: unsubscibe
                };
            });
            return streamId;
        },
        streamId => {
            // Revival:
            
            var buffer = [],
                error,
                closed = false,
                req = {next: x => buffer.push(x), reject: e => error = e, resolve: ()=>closed = true},
                channel = current.channel;
                
            reqs[streamId] = req;
            
            return new Stream ((next, error, close) => {
                // Once the stream is being subscribed to, let's replay buffered content and then continue listening
                Promise.resolve().then(()=>{buffer.forEach(next);
                    buffer = null;
                    if (error !== undefined) error(error);
                    else if (closed) close();
                    req.next = next;
                    req.reject = error;
                    req.resolve = close;
                });
                return () => channel.call("$closeStream", null, [streamId], false);
            });
        }
    ]
});

