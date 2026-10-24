# Terminal demo

From the repository root, install dependencies with `npm ci`, then regenerate with [VHS](https://github.com/charmbracelet/vhs) and its runtime dependencies installed:

```sh
vhs demo/demo.tape
```

The tape writes `demo/demo.gif`. It uses recorded real Gemma 4 e4b replies (`--replay`), so it needs no running model. The order-ID example exports bug-labeled tests to `/tmp/order-id.test.ts`; Vitest intentionally reports five failing tests against the new implementation. The rounding example uses `--label intended` to export without an interactive prompt.

The 1200 × 1000 terminal uses an 18 px font. Sleeps allow the commands to finish and leave their summaries on screen: 11 seconds for order IDs, 8 seconds for failing tests, and 12 seconds for rounding. With 5 ms typing, the tape is about 33 seconds. Locally, the commands took about 4.4, 0.8, and 4.6 seconds respectively. On a slower machine, shorten typing or adjust pauses while keeping the recording under 40 seconds.

The commands were executed and their output checked; `demo/demo.gif` is the rendered result.
