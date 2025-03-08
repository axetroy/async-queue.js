# async-queue.js

[![Badge](https://img.shields.io/badge/link-996.icu-%23FF4D5B.svg?style=flat-square)](https://996.icu/#/en_US)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)
![Node](https://img.shields.io/badge/node-%3E=14-blue.svg?style=flat-square)
[![npm version](https://badge.fury.io/js/%40axetroy%2Fasync-queue.svg)](https://badge.fury.io/js/%40axetroy%2Fasync-queue)

A library to limit the number of concurrent asynchronous tasks.

The queue will start immediately when the task is added to the queue.

## Installation

```bash
npm install @axetroy/async-queue --save
```

## Usage

```js
// import via esm
import { AsyncQueue } from "@axetroy/async-queue";

// import via cjs
const { AsyncQueue } = require("@axetroy/async-queue");
```

```js
import { AsyncQueue } from "@axetroy/async-queue";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const queue = new AsyncTaskQueue({ concurrency: 2 });
// Add task to the queue
queue.enqueue(() => delay(1000).then(() => console.log("Task 1 completed")));
queue.enqueue(() => delay(500).then(() => console.log("Task 2 completed")));
queue.enqueue(() => delay(300).then(() => console.log("Task 3 completed")));
queue.enqueue(() => delay(400).then(() => console.log("Task 4 completed")));

// Wait for all tasks to complete
await queue.waitForAll();
```

## License

The [Anti 996 License](LICENSE)
