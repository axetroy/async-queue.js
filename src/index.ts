type Resolver = (value?: unknown) => void;
type Rejector = (reason?: unknown) => void;

interface Task {
    task: Function;
    args: unknown[];
    resolve: Resolver;
    reject: Rejector;
}

type Promisify<T> = T extends Promise<any> ? T : Promise<T>;

export interface AsyncQueueOptions {
    /**
     * The maximum number of concurrent tasks to run.
     * @default 1
     */
    concurrency?: number;
}

export class AsyncQueue implements Disposable {
    /**
     * Maximum number of concurrent tasks
     * @internal
     */
    private _concurrency: number;
    /**
     * Currently running tasks count
     * @internal
     */
    private _running = 0;
    /**
     * Pending task queue
     * @internal
     */
    private _queue: Task[] = [];
    /**
     * Whether the queue is paused
     * @internal
     */
    private _paused = false;
    /**
     * Completed task count
     * @internal
     */
    private _completed = 0;
    /**
     * Resolvers waiting for all tasks to complete
     * @internal
     */
    private _pendingResolves: Array<{ resolve: Resolver; reject: Rejector }> = [];

    /**
     * Creates an AsyncQueue instance.
     * @param options - Configuration options for the queue.
     */
    constructor(options: AsyncQueueOptions = {}) {
        this.setConcurrency(options.concurrency ?? 1);
    }

    /**
     * Adds a task to the queue.
     * @param task - The task function (must return a Promise).
     * @param args - Arguments for the task function.
     */
    enqueue<T extends (...args: any[]) => any>(task: T, ...args: Parameters<T>): Promisify<ReturnType<T>> {
        return new Promise((resolve, reject) => {
            this._queue.push({ task, args, resolve, reject });
            this._runNext();
        }) as Promisify<ReturnType<T>>;
    }

    /**
     * Runs the next task in the queue, respecting concurrency limits.
     * @internal
     */
    private _runNext() {
        if (this._paused || this._running >= this._concurrency) return;

        if (this._queue.length === 0) {
            // Queue is empty, resolve pending promises
            if (this._running === 0) {
                const pending = this._pendingResolves.splice(0);
                pending.forEach(({ resolve }) => resolve());
            }
            return;
        }

        const { task, args, resolve, reject } = this._queue.shift() as Task;
        this._running++;

        Promise.resolve()
            .then(() => task(...args))
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this._running--;
                this._completed++;
                this._runNext();
            });
    }

    /** Gets the current number of running tasks. */
    get running(): number {
        return this._running;
    }

    /** Gets the number of completed tasks. */
    get completed(): number {
        return this._completed;
    }

    /** Gets the number of pending tasks in the queue. */
    get pending(): number {
        return this._queue.length;
    }

    /** Gets the current concurrency limit. */
    get concurrency(): number {
        return this._concurrency;
    }

    /**
     * Updates the concurrency limit and attempts to run more tasks.
     * @param concurrency - New concurrency level.
     */
    setConcurrency(concurrency: number): void {
        if (concurrency < 1 || Number.isNaN(concurrency) || !Number.isFinite(concurrency) || !Number.isInteger(concurrency)) {
            throw new RangeError("Concurrency must be a positive integer.");
        }
        this._concurrency = Math.max(1, concurrency);
        this._runNext();
    }

    /** Clears the remaining tasks in the queue. */
    clear(): void {
        this._queue.length = 0;
        this._runNext();
    }

    /** Pauses the execution of queued tasks. */
    pause(): void {
        this._paused = true;
    }

    /** Resumes execution of tasks in the queue. */
    resume(): void {
        if (this._paused) {
            this._paused = false;
            this._runNext();
        }
    }

    /** Waits for all queued and running tasks to complete. */
    waitForAll(): Promise<void> {
        return this._running === 0 && this._queue.length === 0
            ? Promise.resolve()
            : new Promise((resolve, reject) => this._pendingResolves.push({ resolve, reject }));
    }

    /** Disposes of the queue, rejecting any pending tasks. */
    dispose(): void {
        while (this._queue.length) {
            const { reject } = this._queue.shift() as Task;
            reject(new Error("Queue disposed before execution."));
        }
    }

    /** Implements Disposable interface cleanup. */
    [Symbol.dispose]() {
        this.dispose();
    }

    /** Returns a string tag for debugging. */
    get [Symbol.toStringTag]() {
        return "AsyncQueue";
    }
}
