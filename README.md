# Racer

Racer is a realtime model synchronization engine for Node.js. By leveraging [ShareDB](https://github.com/share/sharedb), multiple users can interact with the same data in realtime via Operational Transformation, a sophisticated conflict resolution algorithm that works in realtime and with offline clients. ShareDB also supports PubSub across multiple servers for horizontal scaling. Clients can express data subscriptions and fetches in terms of queries and specific documents, so different clients can be subscribed to different overlapping sets of data. On top of this sophisticated backend, Racer provides a simple model and event interface for writing application logic.

## Demos

There are currently two demos, which are included in the [racer-examples](https://github.com/derbyjs/racer-examples) repo.

  * [Pad](https://github.com/derbyjs/racer-examples/tree/master/pad) &ndash; A very simple collaborative text editor.
  * [Todos](https://github.com/derbyjs/racer-examples/tree/master/todos) &ndash; Classic todo list demonstrating the use of Racer's model methods.

## Features

  * **Realtime updates** &ndash; Model methods automatically propagate changes among browser clients and Node servers in realtime. The [racer-browserchannel](https://github.com/derbyjs/racer-browserchannel) adapter is recommended for connecting browsers in realtime.

  * **Realtime query subscriptions** &ndash; Clients may subscribe to a limited set of information relevant to the current session. Both document and realtime query subscriptions are supported. Currently, arbitrary Mongo queries are supported.

  * **Conflict resolution** &ndash; Leveraging ShareDB's JSON Operational Transformation algorithm, Racer will emit events that bring conflicting client states into eventual consistency. In addition to their synchronous API, model methods have callbacks for handling the resolved state after a server response.

  * **Immediate interaction** &ndash; Model methods appear to take effect immediately. Meanwhile, Racer sends updates to the server and checks for conflicts. If the updates are successful, they are stored and broadcast to other clients.

  * **Offline** &ndash; Since model methods are applied immediately, clients continue to work offline. Any changes to the local client or the global state automatically sync upon reconnecting.

  * **Unified server and client interface** &ndash; The same model interface can be used on the server for initial page rendering and on the client for user interaction. Racer supports bundling models created on the server and reinitializing them in the same state in the browser.

  * **Persistent storage** &ndash; Racer uses [ShareDB](https://github.com/share/sharedb) to keep a journal of all data operations, publish operations to multiple frontend servers, and automatically persist documents. It currently supports MongoDB, and it can be easily adapted to support other document stores.

  * **Access control** &ndash; (Under development) Racer will have hooks for access control to protect documents from malicious reads and writes.

  * **Solr queries** &ndash; (Under development) A Solr adapter will support updating Solr indices as data change and queries for realtime updated search results.


## Installation

Racer requires Node.js 22 or newer and [ShareDB](https://github.com/share/sharedb), which is a peer dependency. ShareDB 4, 5, 6 and 7 are supported.

```sh
npm install racer sharedb
```

## Tests

```sh
npm install
npm test         # builds, then runs the tests with Mocha
npm run lint
npm run docs     # generates the API documentation in docs/
```

## Usage

Racer can be used independently as shown in the examples, but Racer and Derby are designed to work especially well together. Racer can also be used along with other MVC frameworks, such as Angular.

For now, Racer is mostly documented along with Derby. See the Derby [model docs](https://derbyjs.github.io/derby/models).

## License

MIT, see [LICENSE](LICENSE).
