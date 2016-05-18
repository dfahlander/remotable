import remotable, {Channel} from '../lib/remotable/remotable';

function hello (name) {
    console.log ("hello() was called");
    return Promise.resolve().then(()=>{
        return "Hello " + name + "!";
    }); 
}

//hello = remotable(hello, {});

var clientChannel = new Channel (channel => {
    channel.onsend(msg => {
        console.log("clientChannel called");
        setTimeout(()=>{
            console.log("clientChannel forwarding to serverChannel.handle()");
            serverChannel.handle (msg);
        }, 0);
    });
    channel.onclose(()=>serverChannel.close());
});
var serverChannel = new Channel (channel => {
    channel.onsend (msg => setTimeout(()=>clientChannel.handle (msg), 0));
    channel.onclose (()=> clientChannel.close());
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
