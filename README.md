# @Remotable
A minimalistic remoting decorator for isomorphic / universal javascript functions running on Browser, Server, WebWorker or ServiceWorker

Work in progress. Still no code. All is in my brain, but it should work as described below.

## Sample

This sample illustrates some piece of isomorphic code that sometimes should run on the server (node), sometimes in the browser, and sometimes in a Web Worker or Service Worker.

### `hello.js`

```js

import Remotable from 'remotable';

@Remotable() // Optionally provide an options argument, such as @Remotable('db')
export async function hello (name) {
    return `Hello ${name}!`;
}

```

Rules:

1. A @Remotable function must return a Promise or Promise-like object (thenable).
2. A @Remotable is identified by class and method name or just function name if not a method.
3. When a @Remotable function is invoked, Remotable.onproxy(_class, _function, ...) is called. If it returns a falsy value, the function will run locally as if not beeing decorated. If a function is returned, the call will be proxied via the returned channeling function.
4. @Remotable() may be used with or without arbritary arguments `@Remotable(arg1, arg2, ...)`. Any arguments passed to the decorator will be forwarded to  Remotable.onproxy(_class, _function, ...decoratorArgs).
5. Configuring the Remoting environment is done by setting Remotable.onproxy = customHandler.
6. Return value from a @Remotable function must be able to JSON-serialize, or otherwise be serializable by a registered serializer in Remotable.serializers array, which is an array of {replacer: Function, reviver: Function} and works exactly as replacer / reviver functions work in the standard JSON.stringify() and JSON.parse().
7. Special built-in support for Observable-like objects - objects with a subscribe method - will be handled specifically:

   A: Client requests an observable-returning function.
   B: Server returns an Observable through a Promise.
   C: Remotable-framework at server serializes this to {"__subscribe__": &lt;observableID&gt;}
   D: Remotable-framework at client revives this to an Observable, whos subscribe() method will:
   
      1. Call "__subscribe__" (&lt;observableID&gt;) remotely on server and expect a stream of values.
   E: Server will for each emitted value, send a message to the client with the value, identified with the connection ID.

### Browser Code

This sample calls the hello function locally, on worker and on server and in all three cases alerts the result. Even though the 'remotable' library knows nothing about Web Workers or socket.io, it is dead simple to configure those as channels because remotable is only interesting in a function that delivers a message and to be called back when a response comes back. The library will make sure to not mix up responses because it has a unique ID for each request to match on when response comes in.

```js
import Remotable from 'remotable';
import io from 'socket.io-client';
import {hello} from './hello';

// Set up a Web Worker and forward responses to Remotable.handle().
var worker = new Worker('./worker.js');
worker.onmessage = ev => Remotable.handle(ev.data);

// Set up a socket.io connection towards the server and forward responses the same way.
var socket = io('http://localhost:3000/');
socket.on('remotable', msg => Remotable.handle(msg));

var whereToRun; // To change dynamically

Remotable.configure({
    onproxy: (_class, _function, options) => {
        if (_function.name === 'hello') {
            switch (whereToRun) {
                case 'locally': return false; // Will make it run locally.
                case 'worker': return msg => worker.postMessage(msg);
                case 'server': return msg => socket.emit('remotable', msg);
            }
        }
    }
});

whereToRun = 'locally';
hello ("David").then(greeting => {
    alert (`hello returned: ${greeting} (executed locally)`);
    
    // Now, let's execute it on the Web Worker:
    whereToRun = "worker";
    return hello ("David");
}).then(greeting => {
    alert (`hello returned: ${greeting} (executed in worker.js)`);
    
    // Now, let's execute it on the server:
    whereToRun = "server";
    return hello ("David");
}).then(greeting => {
    alert (`hello returned: ${greeting} (executed at server)`);
}).catch(e => {
    alert (`Oops: ${e.stack}`);
});

```

### `worker.js`

```js
import Remotable from 'remotable';
import {hello} from './hello';

onmessage = ev => {
    Remotable.handle(ev.data, response => postMessage(response));
}

```

### Server
```js
import Remotable from 'remotable';
import {hello} from './hello';

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
    socket.on('remotable', function(msg){
        Remotable.handle(msg, response => socket.emit(response);
    });  
});

http.listen(3000);

```
