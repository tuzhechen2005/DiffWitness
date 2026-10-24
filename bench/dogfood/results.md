# Dogfood results

Mode: replay; 2026-10-24T19:22:42.190Z; Node v24.19.0; TZ=UTC.
DiffWitness revision: 0aab49e4f91628fa1e3355b30d709fd15ae15f83.
Selection: --only (all); --limit (all).

27 checked, 0 skipped.

The default replay fixtures have no entries for these functions. Checked means change detection and bundling succeeded, not behavioral validation. Zero divergences are not evidence of equivalence.
Divergences and silent count refer to distinct shrunk model repros. A dash means no report. neverRan is only reported when all actual trials threw the same error; a dash in replay does not prove normal execution.

| Repo / commit | Function | Kind | Status | Divergences | Silent | neverRan | Seconds | Reason |
|---|---|---|---|---:|---:|---|---:|---|
| toss/es-toolkit [69a4fd1](https://github.com/toss/es-toolkit/commit/69a4fd1a4390fe803ed90b0bad700513f64fd802) | startCase | fix | checked | 0 | 0 | — | 2.39 |  |
| toss/es-toolkit [64efa41](https://github.com/toss/es-toolkit/commit/64efa4154b142c42e088b3d873bf0c998366093c) | truncate | fix | checked | 0 | 0 | — | 2.64 |  |
| toss/es-toolkit [43e1118](https://github.com/toss/es-toolkit/commit/43e1118884e07cebdf1e767038f6e7f697fa27ec) | deburr | fix | checked | 0 | 0 | — | 2.51 |  |
| toss/es-toolkit [ebea440](https://github.com/toss/es-toolkit/commit/ebea440fe47da124bfa7d9ed6c3084ad5e712832) | deburr | fix | checked | 0 | 0 | — | 2.2 |  |
| toss/es-toolkit [b26a445](https://github.com/toss/es-toolkit/commit/b26a445dedaf0a307d83fa691c8ddfe9e3b4ddc9) | add | fix | checked | 0 | 0 | — | 1.77 |  |
| toss/es-toolkit [6364563](https://github.com/toss/es-toolkit/commit/6364563b317e4e97d33ada2d77da1a9867d46f8e) | without | fix | checked | 0 | 0 | — | 2.23 |  |
| toss/es-toolkit [3aa823c](https://github.com/toss/es-toolkit/commit/3aa823c9a79c1c3a008edee34cdcecdff959d517) | has | fix | checked | 0 | 0 | — | 1.91 |  |
| toss/es-toolkit [51b4612](https://github.com/toss/es-toolkit/commit/51b4612f986d4641dd704c6e329c3684b82b7ebb) | toPath | fix | checked | 0 | 0 | — | 2.08 |  |
| sodiray/radash [4cab190](https://github.com/sodiray/radash/commit/4cab1900d08e0997abc4f17aec3cbfe18958d766) | set | fix | checked | 0 | 0 | — | 1.71 |  |
| sodiray/radash [2d6c10a](https://github.com/sodiray/radash/commit/2d6c10aed775c5e6a8453c37d6e0f09c26680fe2) | get | feature | checked | 0 | 0 | — | 1.64 |  |
| sodiray/radash [c378bd1](https://github.com/sodiray/radash/commit/c378bd1bc401045ed7d8e5e47b275d2159ce43d5) | snake | fix | checked | 0 | 0 | — | 1.66 |  |
| sodiray/radash [b97e47d](https://github.com/sodiray/radash/commit/b97e47d2ed19dbf395c5c00f36726d62f79fd93b) | pick | fix | checked | 0 | 0 | — | 1.76 |  |
| sodiray/radash [f2e6948](https://github.com/sodiray/radash/commit/f2e6948a787282e41c79b58181b1bb7c51e90164) | set | fix | checked | 0 | 0 | — | 2.06 |  |
| sodiray/radash [9981032](https://github.com/sodiray/radash/commit/9981032dc41380e6d19c94852f4484c0f36f985d) | trim | fix | checked | 0 | 0 | — | 1.73 |  |
| sodiray/radash [9266717](https://github.com/sodiray/radash/commit/9266717f5aff3df9792c0e6dba94ee473c1480b7) | assign | fix | checked | 0 | 0 | — | 1.99 |  |
| sodiray/radash [370cc44](https://github.com/sodiray/radash/commit/370cc44ab982e67d3c037030625f1857d0c276fb) | toInt | feature | checked | 0 | 0 | — | 1.7 |  |
| sodiray/radash [383a515](https://github.com/sodiray/radash/commit/383a515eb5f1955f72a16e9cde1c051f4ac4224d) | camel | fix | checked | 0 | 0 | — | 1.25 |  |
| sodiray/radash [3271d3f](https://github.com/sodiray/radash/commit/3271d3fe7ac93dfa10b921effd9154b1b11e9c0e) | flat | perf | checked | 0 | 0 | — | 1.98 |  |
| date-fns/date-fns [882ced6](https://github.com/date-fns/date-fns/commit/882ced61c692c7c4a79eaaec6eb07cb9c8c9195b) | daysToWeeks | fix | checked | 0 | 0 | — | 1.95 |  |
| date-fns/date-fns [b15fdac](https://github.com/date-fns/date-fns/commit/b15fdacc4ec821edf51cc517a8648b953d9cb18f) | roundToNearestMinutes | fix | checked | 0 | 0 | — | 2.36 |  |
| date-fns/date-fns [9ac551c](https://github.com/date-fns/date-fns/commit/9ac551ce5c4f87b298c75cc961f50f9019b3f38b) | areIntervalsOverlapping | fix | checked | 0 | 0 | — | 2.83 |  |
| date-fns/date-fns [0d1a223](https://github.com/date-fns/date-fns/commit/0d1a223993737dbefb98a668c8394f1b31743ced) | isWithinInterval | fix | checked | 0 | 0 | — | 2.03 |  |
| date-fns/date-fns [aa264e3](https://github.com/date-fns/date-fns/commit/aa264e394b66af6c2c4d8d4e2774d0b5bb8f9285) | getOverlappingDaysInIntervals | fix | checked | 0 | 0 | — | 2.38 |  |
| date-fns/date-fns [2939472](https://github.com/date-fns/date-fns/commit/29394724f78d2c0ff23b3c6a9c93965eb5b0ac66) | differenceInCalendarDays | fix | checked | 0 | 0 | — | 2.24 |  |
| date-fns/date-fns [ad2c654](https://github.com/date-fns/date-fns/commit/ad2c654a6a97ebc93961e860760ea1d956fc7cba) | getOverlappingDaysInIntervals | fix | checked | 0 | 0 | — | 2.04 |  |
| date-fns/date-fns [2e72720](https://github.com/date-fns/date-fns/commit/2e7272029f89601baa4bfc229bdba070a4c066a6) | getSeconds | refactor | checked | 0 | 0 | — | 2.37 |  |
| date-fns/date-fns [6da817b](https://github.com/date-fns/date-fns/commit/6da817b939f9b36416b0555e8c8d2b84c2974941) | lightFormat | refactor | checked | 0 | 0 | — | 2.66 |  |
