import assert from "node:assert";
import test, { describe, skip } from "node:test";

import { AsyncQueue } from "../src/index.ts";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AsyncQueue", { skip: true }, () => {
    test("Normal", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        // 检查初始并发数
        assert.strictEqual(queue.running, 0);

        // 添加任务并检查并发执行情况
        const results: string[] = [];
        queue.enqueue(() => sleep(1500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(500).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 4 completed")));

        await sleep(2000); // 等待任务执行完毕

        // 检查结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 3 completed", "Task 4 completed", "Task 1 completed"]);

        // 动态修改最大并发数量
        queue.setConcurrency(3);

        assert.strictEqual(queue.concurrency, 3);

        const moreResults: string[] = [];
        queue.enqueue(() => sleep(600).then(() => moreResults.push("Task 5 completed")));
        queue.enqueue(() => sleep(200).then(() => moreResults.push("Task 6 completed")));
        queue.enqueue(() => sleep(300).then(() => moreResults.push("Task 7 completed")));
        queue.enqueue(() => sleep(400).then(() => moreResults.push("Task 8 completed")));

        await sleep(1000); // 等待任务执行完毕

        // 检查动态修改并发后的结果
        assert.deepStrictEqual(moreResults, ["Task 6 completed", "Task 7 completed", "Task 5 completed", "Task 8 completed"]);

        // 释放资源
        queue.dispose();
    });

    test("pause and resume", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const results: string[] = [];
        queue.enqueue(() => sleep(500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(200).then(() => results.push("Task 4 completed")));

        queue.pause();

        await sleep(1000); // 等待任务执行完毕

        // 检查暂停后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed"]);

        queue.resume();

        await sleep(1000); // 等待任务执行完毕

        // 检查恢复后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed", "Task 3 completed", "Task 4 completed"]);

        // 释放资源
        queue.dispose();
    });

    test("clear", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const results: string[] = [];
        queue.enqueue(() => sleep(500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(200).then(() => results.push("Task 4 completed")));

        queue.clear();

        await sleep(1000); // 等待任务执行完毕

        // 检查清空后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed"]);

        // 释放资源
        queue.dispose();
    });

    test("waitForAll", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const results: string[] = [];
        queue.enqueue(() => sleep(500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 4 completed")));

        await queue.waitForAll();

        // 检查所有任务完成后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed", "Task 3 completed", "Task 4 completed"]);

        // 释放资源
        queue.dispose();
    });

    test("waitForAll with pause and resume", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const results: string[] = [];
        queue.enqueue(() => sleep(500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(200).then(() => results.push("Task 4 completed")));

        queue.pause();

        setTimeout(() => queue.resume(), 1000);

        await queue.waitForAll();

        // 检查所有任务完成后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed", "Task 3 completed", "Task 4 completed"]);

        // 释放资源
        queue.dispose();
    });

    test("waitForAll with clear", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const results: string[] = [];
        queue.enqueue(() => sleep(500).then(() => results.push("Task 1 completed")));
        queue.enqueue(() => sleep(300).then(() => results.push("Task 2 completed")));
        queue.enqueue(() => sleep(400).then(() => results.push("Task 3 completed")));
        queue.enqueue(() => sleep(200).then(() => results.push("Task 4 completed")));

        queue.clear();

        await queue.waitForAll();

        // 检查清空后的结果
        assert.deepStrictEqual(results, ["Task 2 completed", "Task 1 completed"]);

        // 释放资源
        queue.dispose();
    });
});

describe("Invalid AsyncQueue", () => {
    test("Invalid concurrency", async (t) => {
        assert.throws(() => new AsyncQueue({ concurrency: 0 }), { message: "Concurrency must be a positive integer." });
        assert.throws(() => new AsyncQueue({ concurrency: -1 }), { message: "Concurrency must be a positive integer." });
        assert.throws(() => new AsyncQueue({ concurrency: NaN }), { message: "Concurrency must be a positive integer." });
        assert.throws(() => new AsyncQueue({ concurrency: Infinity }), { message: "Concurrency must be a positive integer." });
        assert.throws(() => new AsyncQueue({ concurrency: 1.5 }), { message: "Concurrency must be a positive integer." });
    });

    test("task not return Promise", async (t) => {
        const queue = new AsyncQueue({ concurrency: 2 });

        const p = queue.enqueue(() => "test");

        assert.ok(p instanceof Promise);
        assert.deepEqual(await p, "test");
    });
});
