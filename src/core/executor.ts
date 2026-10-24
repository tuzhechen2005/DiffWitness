import { Worker } from 'node:worker_threads';
import type { Args, LoadedFn, Outcome, Runner } from './types';

// Plain CommonJS so `eval: true` works the same under tsx and vitest.
const WORKER = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { fns, timeoutMs } = workerData;
const NEG0 = '\u0000-0';
const prelude = new vm.Script('var exports = {}; var module = { exports: exports };');

function thrown(e) {
  try {
    // Errors from the vm realm fail instanceof here, so detect them by brand.
    const isErr = Object.prototype.toString.call(e) === '[object Error]';
    return { kind: 'throw', name: isErr ? String(e.name) : typeof e, message: isErr ? String(e.message) : String(e) };
  } catch {
    return { kind: 'throw', name: typeof e, message: 'unprintable thrown value' };
  }
}

function call(side, args) {
  const f = fns[side];
  try {
    // Null-prototype sandbox: a host-realm object would let code reach process via constructor.constructor.
    const sandbox = Object.create(null);
    // Args cross as a JSON string so the context only ever sees its own objects; -0 survives via a marker.
    sandbox.__args = JSON.stringify(args, (k, v) => (Object.is(v, -0) ? NEG0 : v));
    const ctx = vm.createContext(sandbox, { microtaskMode: 'afterEvaluate' });
    const end = Date.now() + timeoutMs;
    const left = () => Math.max(1, end - Date.now());
    prelude.runInContext(ctx);
    (f.script ??= new vm.Script(f.code)).runInContext(ctx, { timeout: left() });
    f.call ??= new vm.Script('module.exports[' + JSON.stringify(f.name) + '](...JSON.parse(__args, (k, v) => (v === ' + JSON.stringify(NEG0) + ' ? -0 : v)))');
    return { kind: 'return', value: f.call.runInContext(ctx, { timeout: left() }) };
  } catch (e) {
    // vm creates its timeout error inside the context realm, so match it by code, not instanceof.
    if (e !== null && typeof e === 'object' && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return { kind: 'timeout' };
    return thrown(e);
  }
}

process.on('unhandledRejection', () => {});
parentPort.on('message', ({ side, args }) => {
  const outcome = call(side, args);
  try {
    parentPort.postMessage(outcome);
  } catch (e) {
    parentPort.postMessage({ kind: 'throw', name: 'DiffWitnessUncloneable', message: String(e && e.message) });
  }
});
`;

/**
 * Starts an isolated runner for the two functions. Issue #2.
 * - worker_threads + node:vm, fresh vm context per call, no require/process/import in the context
 * - per-call timeout (default 1000 ms); a timed-out call yields { kind: 'timeout' } and the worker is replaced
 * - must work under both tsx and vitest (hint: `new Worker(src, { eval: true })` with an inline JS string)
 */
export async function createRunner(
  oldFn: LoadedFn,
  newFn: LoadedFn,
  opts: { timeoutMs?: number } = {},
): Promise<Runner> {
  const timeoutMs = opts.timeoutMs ?? 1000;
  const workerData = { fns: [oldFn, newFn].map((f) => ({ name: f.name, code: f.code })), timeoutMs };
  let worker: Worker | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const spawn = () => {
    const w = new Worker(WORKER, { eval: true, workerData });
    // shortcut: a crashed worker (e.g. out of memory) surfaces as a timeout via the host timer; report it separately if users hit it.
    w.on('error', () => {});
    return w;
  };

  const call = (side: 0 | 1, args: Args) =>
    new Promise<Outcome>((resolve) => {
      const w = (worker ??= spawn());
      // Backstop for hangs vm's timeout cannot see (e.g. a getter looping while the result is cloned).
      const timer = setTimeout(() => {
        worker = undefined;
        void w.terminate();
        resolve({ kind: 'timeout' });
      }, timeoutMs + 1000);
      w.once('message', (o: Outcome) => {
        clearTimeout(timer);
        resolve(o);
      });
      w.postMessage({ side, args });
    });

  return {
    run(args) {
      // One request in flight at a time, so replies can never be matched to the wrong call.
      const p = queue.then(async () => ({ old: await call(0, args), new: await call(1, args) }));
      queue = p.catch(() => {});
      return p;
    },
    async close() {
      await queue;
      await worker?.terminate();
      worker = undefined;
    },
  };
}
