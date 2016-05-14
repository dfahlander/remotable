# @remotable
A small and pretty way to declare javascript functions that may be invoked elsewhere, such as on a Node.JS server, a Web Worker, a Service Worker or another iframe of alternate origin.

In short:

* An ES7 decorator `@remotable` makes a method possible to invoke remotely.
* Include the same decorated method both in browser, worker, node etc.
* Each platform use a few lines of bootstrap code to configure where other nodes are located and how to reach them.
* Can also be used also in ES5/ES6 by preceding function as `var myFunction = remotable(options, function (a,b,c) {...});`
* No dependencies.

This is a work in progress. Code is complete but not tested at all. Documentation lies within this readme.

## Use Cases

1. Page rendering on client or server depending on state.
2. Database access from indexedDB when offline, from ServiceWorker when present, or from a backend database when online
3. Just a way to declare remote functions that will always be remote - an alternate way to REST.
4. Run a javascript stored procedure in Postgres. Declare it in common code. On client delegate it to server. On server, delegate it further to the database engine.

## Sample

This sample illustrates some piece of isomorphic code that sometimes should run on the server (node), sometimes in the browser, and sometimes in a Web Worker or Service Worker.

### Library code (common) `hello.js`

```js

import remotable from 'remotable';

export class Foo {

    @remotable() // Optionally provide an options argument, such as @remotable({runat: 'worker'})
    async hello (name) {
        return `Hello ${name}!`;
    }
}

new Foo().hello("David"); // Runs locally and returns "Hello David" because we havent configured remoteable yet.

```

### `worker.js`

```js
import remotable from 'remotable';
import {Foo} from './hello';

onmessage = ev => {
    remotable.handle(ev.data, response => postMessage(response));
}

```

### Server
```js
import remotable from 'remotable';
import {Foo} from './hello';

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
    socket.on('remotable', function(msg){
        remotable.handle(msg, response => socket.emit(response);
    });  
});

http.listen(3000);

```

### Browser Code

This sample calls the hello function locally, on worker and on server and in all three cases alerts the result. Even though the 'remotable' library knows nothing about Web Workers or socket.io, it is dead simple to configure those as channels because remotable is only interesting in a function that delivers a message and to be called back when a response comes back. The library will make sure to not mix up responses because it has a unique ID for each request to match on when response comes in.

```js
import remotable from 'remotable';
import io from 'socket.io-client';
import {hello} from './hello';

// Set up a Web Worker and forward responses to remotable.handle().
var worker = new Worker('./worker.js');
worker.onmessage = ev => remotable.handle(ev.data);

// Set up a socket.io connection towards the server and forward responses the same way.
var socket = io('http://localhost:3000/');
socket.on('remotable', msg => remotable.handle(msg));

var whereToRun; // To change dynamically

remotable.onroute((options, id, func, thiz, args) => {
    if (id === 'Foo.hello') {
        switch (whereToRun) {
            case 'locally': return false; // Will make it run locally.
            case 'worker': return msg => worker.postMessage(msg);
            case 'server': return msg => socket.emit('remotable', msg);
        }
    }
});

whereToRun = 'locally';
var foo = new Foo();
foo.hello ("David").then(greeting => {
    alert (`hello returned: ${greeting} (executed locally)`);
    
    // Now, let's execute it on the Web Worker:
    whereToRun = "worker";
    return foo.hello ("David");
}).then(greeting => {
    alert (`hello returned: ${greeting} (executed in worker.js)`);
    
    // Now, let's execute it on the server:
    whereToRun = "server";
    return foo.hello ("David");
}).then(greeting => {
    alert (`hello returned: ${greeting} (executed at server)`);
}).catch(e => {
    alert (`Oops: ${e.stack}`);
});

```


# Rules:

1. A @remotable method must return a Promise or Promise-like object (thenable).
2. A @remotable is identified by class and method name or just function name if not a method.
3. When a @remotable function is invoked, remotable.onroute(options, methodName, func, thiz, args) is called. If it returns a falsy value, the function will run locally as if not beeing decorated. If a function is returned, the call will be proxied via the returned channeling function.
4. @remotable() may be used with or without an options arguments `@remotable(options)`. Options argument passed to the decorator will be forwarded to any registered remotable.onroute callback.
5. Configuring the Remoting environment is done by subscriboing to remotable.onroute: `remotable.onroute(callback)`.
6. Return value from a @remotable function must be able to JSON-serialize, or otherwise be serializable by a registered type registered through `remotable.registerType(typeID: string, tester: any => boolean, replacer: any => any, reviver: any => any)`.
7. Special built-in support for Observable-like objects - objects with a subscribe method - will be handled specifically:

   1. Client requests an observable-returning function.
   2. Server returns an Observable through a Promise.
   3. remotable-framework at server serializes this to `{"__subscribe__": <observableID>}`
   4. remotable-framework at client revives this to an Observable, whos subscribe() method will:
   
      1. Call `"__subscribe__" (<observableID>)` remotely on server and expect a stream of values.
   5. Server will for each emitted value, send a message to the client with the value, identified with the connection ID.

# Options
The options argument `@remotable(options)` can be used with custom options to be read from the onroute() callback. However, there are a few built-in options to use for simplicity:

## runat
```js
@remotable({runat: 'server'})
async hello() {...}
```
In combination with having configured remotable like this:

```js
remotable.configure ({
    roles: {
        local: null,
        server: msg => socket.emit('remotable', msg),
        worker: msg => worker.postMessage(msg)
    }
});
```
... will make the function always run on server.

# API

## remotable.registerType

All standard JSON types are served by default. But when in need of serializing complex types better than plain JSON can do, it's possible to register a type and provide a way to replace and revive it through the JSON channel. 

### Sample

```js
remotable.registerType (
    "Date",
    value => value instanceof Date, // tester
    value => value.getTime(),       // replacer
    value => new Date(value));      // reviver
```

### Syntax
```ts
remotable.registerType (
    typeId: string,
    tester: (value: any) => boolean,
    replacer: (value: any) => any,
    reviver: (value: any) => any
);
```

## remotable.configure

### Syntax
```ts
remotable.configure ({
    roles: {
        [role:string]: (msg:string) => void
    }
});
```

### Remarks
Configures where (and if) to emit a remoting message to that role. If a role is not configured, messages to it will be served locally. When configuring a remote role, a listener must also be configured, see sample below.

The msg parameter is just a JSON string that you don't need to interpret. You just provide a channel where to emit it. When message reaches the remote node, that one will pick it up and send it to `remotable.handle()` that will be able to parse the message, execute it and respond to it when its Promise resolves.

### Sample

```js
var worker = new Worker('./worker.js');
// Configure the listener:
worker.onmessage = ev => remotable.handle(ev.data);

remotable.configure({
    roles: {
        // Configure the emitter:
        worker: msg => worker.postMessage(msg)
});
```js

### Sample2 (where role location vary)

```js
var worker = new Worker('./worker.js');
worker.onmessage = ev => remotable.handle(ev.data);
var socket = io('http://localhost:3000/');
socket.on('remotable', msg => remotable.handle(msg));

remotable.configure({
    roles: {
        db: msg => isOffline ?
            worker.postMessage(msg) : // If offline, use a local database served from Web worker
            socket.emit('remotable', msg), // If online, use backend database
    }
});

```

## remotable.onroute

Register a callback that onroutes if a method should run local or remote, and provides a channel to execute it remotely. This method is a lower-level version of remotable.configure({roles: {...}).

### Syntax
```ts
remotable.onroute(callback: (
    options: Object,    // Options provided to @remotable(options)
    id: string,         // ClassName + "." + methodName (or id provided in options)
    func: Function,     // Function to be called (method)
    thiz: any,          // This-context
    args: any[]         // arguments
) =>
    (msg:string) => void;   // Return a callback taking a string and emitting it to the remote party.
```

### Sample

```js
remotable.onroute((options, id, func, thiz, args) => {
    console.log(JSON.stringify(options)); // For example {"runat": "server"}
    console.log(id); // For example "Foo.hello"
    console.log(func.name); // For example "hello".
    console.log(JSON.stringify(thiz)); // The this-context of the method being called.
    console.log(JSON.stringify(args)); // The arguments provided to method.
    
    if (id === 'Foo.hello') {
        switch (whereToRun) {
            case 'locally': return null; // A falsy return value makes it run locally.
            case 'worker': return msg => worker.postMessage(msg);
            case 'server': return msg => socket.emit('remotable', msg);
        }
    }
});

```
