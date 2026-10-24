# Git-history dogfood corpus

27 inspected commits from three utility libraries. These are real changes, not
planted bugs or labeled ground truth. A fix can intentionally introduce a silent
divergence; a refactor may preserve behavior. `kind` describes the selected
function's change, not every file in the upstream commit.

## Provenance and licenses

Each repository was cloned from its public GitHub HTTPS URL. For every candidate,
we inspected `git diff <sha>~1 <sha> -- <path>`, read the selected exported function,
and opened the commit through GitHub's commits API, checking its `html_url` and
changed-file list. `candidates.json` contains those exact URLs and full SHAs.
License files were read at both the candidate and its first parent, rather than
assuming today's license applies to old revisions.

| Repository | Candidates | License at selected revisions |
|---|---:|---|
| [toss/es-toolkit](https://github.com/toss/es-toolkit) | 8 | [MIT](https://github.com/toss/es-toolkit/blob/69a4fd1a4390fe803ed90b0bad700513f64fd802/LICENSE) |
| [sodiray/radash](https://github.com/sodiray/radash) | 10 | [MIT](https://github.com/sodiray/radash/blob/4cab1900d08e0997abc4f17aec3cbfe18958d766/LICENSE.md) for 7; [BSD-3-Clause](https://github.com/sodiray/radash/blob/370cc44ab982e67d3c037030625f1857d0c276fb/LICENSE.md) for `370cc44`, `383a515`, `3271d3f` |
| [date-fns/date-fns](https://github.com/date-fns/date-fns) | 9 | [MIT](https://github.com/date-fns/date-fns/blob/882ced61c692c7c4a79eaaec6eb07cb9c8c9195b/LICENSE.md) |

No upstream source code is copied into this corpus. Selection favors small
utilities with JSON input subsets: strings, numbers, arrays, plain objects,
string paths, numeric timestamps, and interval objects with numeric endpoints.
Optional RegExp, symbol, Date-instance, custom-constructor, and callback inputs
are outside that subset. For example, `truncate` can use a string separator and
`roundToNearestMinutes` can use a timestamp and plain options object.

The entry files and their recursive local import graphs on both revisions were
scanned for external imports and unsupported runtime identifiers (`process`,
`Buffer`, `fetch`, `global`, `window`, `document`, `require`): none were found.
Replay also bundled every pair without installing upstream dependencies.
This is a compatibility screen, not a security audit; Node's vm is not a security
sandbox. Type inference is incomplete for upstream generics and imported aliases;
JSON-representable does not mean every useful input passes the current type filter.

## Inspected changes

Short SHAs below map to the full commits in `candidates.json`.

| Commit | Export | Function-body change |
|---|---|---|
| `69a4fd1` | startCase | Preserve the rest of each word while uppercasing its first code point. |
| `64efa41` | truncate | Escape a string separator before inserting it into a regular expression. |
| `43e1118` | deburr | Process characters individually to preserve non-Latin scripts. |
| `ebea440` | deburr | Replace delegation with a Latin-character mapping loop. |
| `b26a445` | add | Separate missing operands from null and change string coercion. |
| `6364563` | without | Replace delegation with a filtering loop that normalizes negative zero. |
| `3aa823c` | has | Normalize path keys through toKey before lookup. |
| `51b4612` | toPath | Split unquoted dotted bracket keys into path segments. |
| `4cab190` | set | Recognize numeric path segments with a complete-digit check. |
| `2d6c10a` | get | Strip quotes from bracket path components. |
| `c378bd1` | snake | Split letters from numbers, controlled by an option. |
| `b97e47d` | pick | Use the prototype's hasOwnProperty instead of an object's own member. |
| `f2e6948` | set | Accept falsy values other than undefined. |
| `9981032` | trim | Escape metacharacters in the trim character set. |
| `9266717` | assign | Merge the union of keys, preserving keys unique to either input. |
| `370cc44` | toInt | Preserve an explicit null fallback. |
| `383a515` | camel | Change word splitting and capitalization. |
| `3271d3f` | flat | Accumulate with push instead of repeatedly copying with spread. |
| `882ced6` | daysToWeeks | Normalize a negative-zero result. |
| `b15fdac` | roundToNearestMinutes | Include milliseconds and remove double rounding. |
| `9ac551c` | areIntervalsOverlapping | Sort endpoint timestamps numerically. |
| `0d1a223` | isWithinInterval | Sort endpoint timestamps numerically. |
| `aa264e3` | getOverlappingDaysInIntervals | Adjust overlap endpoints for timezone offsets. |
| `2939472` | differenceInCalendarDays | Restore rounding instead of truncation. |
| `ad2c654` | getOverlappingDaysInIntervals | Sort endpoint timestamps numerically. |
| `2e72720` | getSeconds | Inline the local date conversion into the return expression. |
| `6da817b` | lightFormat | Rename the local normalized-date variable and its uses. |

This is a convenience sample, mostly fixes, with two feature changes, one
performance change, and two refactors. It is not representative of all TS repos.
UTC is fixed for reproducibility; daylight-saving-specific changes may be
behaviorally invisible under that timezone. Negative zero survives DiffWitness's
executor transport, but ordinary JSON serializers do not preserve it.

## Run

From the DiffWitness checkout after `npm ci`:

```sh
# No model required: validate git detection, both bundles, and report collection.
DIFFWITNESS_REPLAY=1 npx tsx scripts/dogfood.ts
DIFFWITNESS_REPLAY=1 npx tsx scripts/dogfood.ts --only sodiray/radash --limit 3

# Live Ollama, using the CLI's normal OLLAMA_URL / DIFFWITNESS_MODEL settings.
# Ensure DIFFWITNESS_REPLAY is unset for this run.
npx tsx scripts/dogfood.ts --limit 10

# Focused runner tests, deliberately outside npm test.
npx tsx --test bench/dogfood/runner.test.ts
```

The script resolves its corpus and CLI entry relative to itself, so an absolute
script path also works from another working directory. `--only` is an exact
`owner/repo`; `--limit` is a positive integer, applied after that filter.

Repositories are shallow-cloned into `os.tmpdir()/diffwitness-dogfood/`, then each
SHA and its parent are fetched at depth two. The runner checks the cache's origin
and refuses to overwrite tracked changes. Run one instance at a time: the cache
checkout is shared. An interrupted initial clone can leave an incomplete cache;
remove that repository's cache directory before retrying.

The CLI is invoked with the absolute `bin/diffwitness.mjs` path and
`--git <sha>~1..<sha> --path <path> --fn <fn> --json`. Only an unresolved external
package triggers `npm ci --ignore-scripts`; a missing npm lockfile or failed
install is recorded as a skip. Each external command has a 20-minute bound.
Clone, checkout, install, CLI, and parsing errors become per-candidate skip reasons
so the rest of the corpus can finish. A completed batch can therefore exit zero
with skips: read the status column.

Every run prints a Markdown table and replaces `results.md`, including when
filters select a subset. Seconds include fetching, checkout, any installation,
and the CLI. Counts are distinct shrunk model repros, not raw trials. `neverRan`
preserves the CLI's all-trials-threw diagnostic; absence does not establish that
any calls ran.

## Validation

The committed `results.md` is a replay run: 27 checked, zero skipped (es-toolkit
8/8, radash 10/10, date-fns 9/9). The default replay fixtures contain no hypotheses
for these pairs, so all divergence counts are zero. This proves detection and
bundling, not equivalence, bug detection, or model performance. No live model was
called. A separate dirty-cache check produced an explicit skip without modifying
the cache; invalid limits and unknown repository filters were also rejected.
