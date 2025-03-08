interface Task {
    task: Function;
    args: unknown[];
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

type Promisify<T> = T extends Promise<any> ? T : Promise<T>;

export interface AsyncQueueOptions {
    concurrency?: number;
}

export class AsyncQueue implements Disposable {
    /** @internal */
    private _concurrency: number;
    /** @internal */
    private _running = 0;
    /** @internal */
    private _queue: Task[] = [];
    /** @internal */
    private __paused = false;
    /** @internal */
    private _completed = 0;
    /** @internal */
    private _pendingResolves: Function[] = [];

    /**
     * Creates an AsyncQueue instance.
     * @param options - The options to create the queue with.
     */
    constructor(options: AsyncQueueOptions = {}) {
        const { concurrency = 1 } = options;
        this._concurrency = concurrency;
    }

    /**
     * Adds a task to the queue.
     * @param task - The task to add. Should return a Promise.
     * @param args - The arguments to call the task with.
     */
    enqueue<T extends (...args: any[]) => any>(task: T, ...args: Parameters<T>): Promisify<ReturnType<T>> {
        return new Promise((resolve, reject) => {
            this._queue.push({ task, args, resolve, reject });
            this._runNext();
        }) as Promisify<ReturnType<T>>;
    }

    /**
     * Runs the next task in the queue (if concurrency limit allows).
     * @internal
     */
    private _runNext() {
        // If the queue is paused, do not run any tasks
        if (this.__paused) {
            return;
        }

        // If the maximum concurrency is reached, do not run any tasks
        if (this._running >= this._concurrency) {
            return;
        }

        // If the queue is empty and no tasks are running, resolve all pending promises
        if (this._running === 0 && this._queue.length === 0) {
            while (this._pendingResolves.length > 0) {
                const resolve = this._pendingResolves.shift();
                resolve?.();
            }
            return;
        }

        // If the queue is empty, return
        if (this._queue.length === 0) {
            return;
        }

        const { task, args, resolve, reject } = this._queue.shift() as Task;
        this._running++;

        task(...args)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this._running--;
                this._completed++;
                this._runNext();
            });
    }

    /**
     * Gets the current number of running tasks in the queue.
     */
    get running() {
        return this._running;
    }

    /**
     * Gets the number of completed tasks in the queue.
     */
    get completed() {
        return this._completed;
    }

    /**
     * Gets the number of pending tasks in the queue.
     */
    get pending() {
        return this._queue.length;
    }

    /**
     * Gets the current number of concurrent tasks.
     */
    get concurrency(): number {
        return this._concurrency;
    }

    /**
     * Dynamically updates the number of concurrent tasks.
     * @param concurrency - The new number of concurrent tasks.
     */
    setConcurrency(concurrency: number) {
        this._concurrency = concurrency;
        this._runNext();
    }

    /**
     * Clears the remaining queue without rejecting tasks.
     */
    clear(): void {
        this._queue = [];
    }

    /**
     * Pauses the queue processing.
     */
    pause(): void {
        this.__paused = true;
    }

    /**
     * Resumes the queue processing.
     */
    resume(): void {
        if (this.__paused) {
            this.__paused = false;
            this._runNext();
        }
    }

    /**
     * Waits for all tasks to complete.
     */
    waitForAll(): Promise<void> {
        if (this._running === 0 && this._queue.length === 0) {
            return Promise.resolve(); // Queue is empty, return immediately
        }
        return new Promise((resolve) => {
            this._pendingResolves.push(resolve);
        });
    }

    /**
     * Releases resources, clears the queue, and ensures unexecuted tasks are rejected.
     */
    dispose(): void {
        while (this._queue.length > 0) {
            const { reject } = this._queue.shift() as Task;
            reject(new Error("Queue disposed before execution."));
        }
    }

    /**
     * Releases resources, clears the queue, and ensures unexecuted tasks are rejected.
     */
    [Symbol.dispose]() {
        this.dispose();
    }

    /**
     * Returns the string representation of the object.
     */
    get [Symbol.toStringTag]() {
        return "AsyncQueue";
    }
}
