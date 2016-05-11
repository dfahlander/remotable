# Remotable
A minimalistic remoting decorator for isomorphic javascript functions running on node, WebWorker or ServiceWorker

Work in progress. Still no code. All is in my brain, but it should work as described below.

## Sample

This sample illustrates what I'm trying to accomplish. You have some piece of isomorphic code that sometimes should run on the server (node), sometimes in the browser, and in some circumstances, in a Web Worker or Service Worker.

### `hello.js`

```js

import Remotable from 'remotable';

@Remotable('testdomain')
export async function hello (name) {
    return `Hello ${name}!`;
}

```

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

Remotable.configure ({
    testdomain: () => {
        switch (whereToRun) {
            case 'locally': return null; // Will make it run locally.
            case 'worker': return msg => worker.postMessage(msg);
            case 'server': return msg => socket.emit('remotable', msg);
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
