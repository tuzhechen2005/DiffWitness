import { Worker } from 'node:worker_threads';
import type { Args, LoadedFn, Outcome, Pair, Runner } from './types';

type Reply = { o: Outcome; cov?: number[] };

// Plain CommonJS so `eval: true` works the same under tsx and vitest.
const WORKER = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { fns, timeoutMs } = workerData;
const NEG0 = '\u0000-0';
const prelude = new vm.Script('var exports = {}; var module = { exports: exports };');
// __diffwitness_cov__ is built inside the context (never a host array); hits leave it as a primitive string.
const covInit = new vm.Script('var __diffwitness_cov__ = [];');
const covRead = new vm.Script('var __r = []; for (var __i = 0; __i < __diffwitness_cov__.length; __i++) if (__diffwitness_cov__[__i] === 1) __r.push(__i); __r.join()');

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
  f.cov ??= f.code.includes('__diffwitness_cov__');
  let ctx, left;
  const res = (o) => {
    if (!f.cov || o.kind === 'timeout') return { o };
    try {
      const hits = covRead.runInContext(ctx, { timeout: left() });
      // Never coerce a context object here: its toString would run outside the vm timeout.
      if (typeof hits !== 'string') return { o };
      return { o, cov: hits ? hits.split(',').map(Number) : [] };
    } catch {
      return { o };
    }
  };
  try {
    // Null-prototype sandbox: a host-realm object would let code reach process via constructor.constructor.
    const sandbox = Object.create(null);
    // Args cross as a JSON string so the context only ever sees its own objects; -0 survives via a marker.
    sandbox.__args = JSON.stringify(args, (k, v) => (Object.is(v, -0) ? NEG0 : v));
    ctx = vm.createContext(sandbox, { microtaskMode: 'afterEvaluate' });
    const end = Date.now() + timeoutMs;
    left = () => Math.max(1, end - Date.now());
    prelude.runInContext(ctx);
    if (f.cov) covInit.runInContext(ctx);
    (f.script ??= new vm.Script(f.code)).runInContext(ctx, { timeout: left() });
    f.call ??= new vm.Script('module.exports[' + JSON.stringify(f.name) + '](...JSON.parse(__args, (k, v) => (v === ' + JSON.stringify(NEG0) + ' ? -0 : v)))');
    const value = f.call.runInContext(ctx, { timeout: left() });
    // shortcut: async functions are rejected (witness() aborts on this name), support them if users need it.
    if (value !== null && typeof value === 'object' && typeof value.then === 'function') return res({ kind: 'throw', name: 'DiffWitnessAsync', message: 'returned a Promise' });
    return res({ kind: 'return', value });
  } catch (e) {
    // vm creates its timeout error inside the context realm, so match it by code, not instanceof.
    if (e !== null && typeof e === 'object' && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return { o: { kind: 'timeout' } };
    return ctx ? res(thrown(e)) : { o: thrown(e) };
  }
}

process.on('unhandledRejection', () => {});
parentPort.on('message', ({ side, args }) => {
  const r = call(side, args);
  try {
    parentPort.postMessage(r);
  } catch (e) {
    parentPort.postMessage({ o: { kind: 'throw', name: 'DiffWitnessUncloneable', message: String(e && e.message) }, cov: r.cov });
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
    new Promise<Reply>((resolve) => {
      const w = (worker ??= spawn());
      // Backstop for hangs vm's timeout cannot see (e.g. a getter looping while the result is cloned).
      const timer = setTimeout(() => {
        worker = undefined;
        void w.terminate();
        resolve({ o: { kind: 'timeout' } });
      }, timeoutMs + 1000);
      w.once('message', (r: Reply) => {
        clearTimeout(timer);
        resolve(r);
      });
      w.postMessage({ side, args });
    });

  return {
    run(args) {
      // One request in flight at a time, so replies can never be matched to the wrong call.
      const p = queue.then(async (): Promise<Pair> => {
        const [a, b] = [await call(0, args), await call(1, args)];
        return a.cov || b.cov ? { old: a.o, new: b.o, coverage: { old: a.cov ?? [], new: b.cov ?? [] } } : { old: a.o, new: b.o };
      });
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
