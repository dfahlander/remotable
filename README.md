# runat-decorator
A minimalistic remoting decorator for isomorphic javascript functions running on node, WebWorker or ServiceWorker

Work in progress. Still no code. All is in my brain, but:

## Sample

This sample illustrates what I'm trying to accomplish. You have some piece of isomorphic code that sometimes should run on the server (node), sometimes in the browser, and in some circumstances, in a Web Worker or Service Worker.

```js

import Remotable from 'remotable';

@Remotable
async function hello (name) {
    return `Hello ${name}!`;
}

```

### 

### Browser

```js
import RunAt from 'runat-decorator';
import hello from '../isomorphic/hello-world';


### Worker

### Node

