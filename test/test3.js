import remotable, {Channel} from '../lib/remotable/remotable';

function hello (name) {
    console.log ("hello() was called");
    return Promise.resolve().then(()=>{
        return "Hello " + name + "!";
    }); 
}

hello = remotable(hello, {});

var clientChannel = new Channel (channel => {
    return msg => {
        console.log("clientChannel called");
        setTimeout(()=>{
            console.log("clientChannel forwarding to serverChannel.handle()");
            serverChannel.handle (msg);
        }, 0);
    } 
});
var serverChannel = new Channel (channel => {
    return msg => setTimeout(()=>clientChannel.handle (msg), 0);
});

var channel;

remotable.onroute (function (options, methodName, func) {
    console.log("onroute");
    return channel;
});

channel = clientChannel;
console.log("Calling hello('David')");
hello("David").then(result => {
    console.log("Result: " + result);
});
console.log("Resetting channel");
channel = null;
