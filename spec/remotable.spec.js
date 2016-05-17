var Serializer = require('../lib/serializer');
var Stream = require('../lib/stream');
describe("remotable", () => {
    var s = new Serializer();
    s.registerType("Date", x => x instanceof Date, date => date.getTime(), time => new Date(time));
    var obj = {hej: 1, oj: "", aj: [1,2,3], ij: {oppa: new Date()}};
    var t = s.stringify (obj, null, 4);
    //console.log(t);
    var back = s.parse (t);
    //console.log(JSON.stringify(back, null, 4));
});

describe("stream", ()=>{
    var s = new Stream((next, error, close) => {
        var handle = setInterval(()=>{
            next ("Utter");
            next ("Apa");
            error("Attans");
            close();
        }, 25);
        return () => clearInterval(handle);
    });
    var unsubscribe = s.subscribe(val => console.log("got: " + val), err => console.error(err), close => console.log("Got close signal."));
    //setTimeout(unsubscribe, 1000);
});