// Shared contracts. Every module codes against these; change them only via the integrator.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
/** Positional arguments for one call. Inputs are JSON-only by design. */
export type Args = Json[];

export interface LoadedFn {
  /** Exported function name, e.g. "normalizeOrderId". */
  name: string;
  /** Original TypeScript source (used for prompts and replay keys). */
  source: string;
  /** Type-stripped CommonJS that assigns `exports[name]`. Contains no imports. */
  code: string;
}

/** What one call did. Return values may be any structured-cloneable value. */
export type Outcome =
  | { kind: 'return'; value: unknown }
  | { kind: 'throw'; name: string; message: string }
  | { kind: 'timeout' };

export interface Pair {
  old: Outcome;
  new: Outcome;
}

export interface Runner {
  /** Calls old and new with a fresh copy of `args` each, in a fresh vm context each. */
  run(args: Args): Promise<Pair>;
  close(): Promise<void>;
}

export interface Hypothesis {
  /** Why the model thinks this input splits old from new. */
  reason: string;
  args: Args;
  round: 1 | 2;
}

export interface Trial {
  hypothesis: Hypothesis;
  pair: Pair;
}

export interface ProposeInput {
  old: LoadedFn;
  new: LoadedFn;
  round: 1 | 2;
  /** Round 2 only: every round-1 trial with its real outcomes. */
  previous: Trial[];
}

export interface Hypothesizer {
  /** Human-readable source, e.g. "gemma4:e4b @ http://host:11434" or "replay (handwritten)". */
  label: string;
  /** Returns at most 8 hypotheses; never throws on malformed model output (drops bad items). */
  propose(input: ProposeInput): Promise<Hypothesis[]>;
}

export interface Divergence {
  /** Minimal (shrunk) args that still diverge with the same outcome kinds. */
  args: Args;
  pair: Pair;
  /** Reasons from every hypothesis that shrank to these args. */
  reasons: string[];
  /** The model's original args for each merged hypothesis. */
  originalArgs: Args[];
  shrinkSteps: number;
}

export interface BaselineResult {
  runs: number;
  divergent: number;
  /** Divergent runs where both versions returned normally. */
  silent: number;
  firstDivergentArgs?: Args;
  /** Distinct minimal repros from shrinking the first 20 divergent random runs. */
  repros: Args[];
}

export interface WitnessReport {
  fnName: string;
  hypothesizer: string;
  rounds: 1 | 2;
  trials: Trial[];
  divergences: Divergence[];
  /** Naive random fuzzing over the shape of the first hypothesis' args; absent if no hypotheses. */
  baseline?: BaselineResult;
}

export type Label = 'bug' | 'intended';

export interface LabeledDivergence {
  divergence: Divergence;
  label: Label;
}
