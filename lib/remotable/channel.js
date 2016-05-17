import Promise from './promise';
import registry from './registry';

var counter = 0;

export default function Channel(init) {
    var reqs = {};
    
    this.call = function (method, thiz, args) {
        return new Promise(function (resolve, reject) {
            var reqId = ++counter;
            send({
                id: reqId,
                op: "call",
                method: method,
                thiz: thiz,
                args: args
            });
            reqs[reqId] = {resolve: resolve, reject: reject};
        });
    };
    
    this.handle = function (msg) {
        console.log("handle(): " + JSON.stringify(msg));
        var id = msg.id,
            op = msg.op;
            
        if (op === 'call') {
            var meth = registry[msg.method];
            if (meth) { 
                Promise.resolve(meth.apply(msg.thiz, msg.args)).then(function (result) {
                    send({op: "res", id: id, data: result});
                }).catch(function (error) {
                    send({op: "rej", id: id, data: error});
                });
            } else {
                send({op: "rej", id: id, data: new Error("Unknown Function: " + method)});
            }
            return;
        }
        var req = reqs[id];
        if (!req) return;
        if (op === 'res' || op === 'rej') {
            req[op === 'res' ? 'resolve' : 'reject'](msg.data);
            delete reqs[id];
        } else if (op === 'next') {
            req.next(req.data);
        }
    };
    
    var send = this.send = init(this);
}
