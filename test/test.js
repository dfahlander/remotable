import Stream from "../lib/stream";

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
setTimeout(unsubscribe, 100);
