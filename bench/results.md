# Refactor benchmark

Hypothesizer: replay (fixtures/replay.json). Runs per case: 1. Random seed: 1 (reset per case).

Replay validation only; these are not live model measurements. Missing fixture keys yield no hypotheses.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| access-rule | 0/1 (0.0%) | 44 / 200 | 0.068 |
| dedupe-order | 0/1 (0.0%) | 101 / 200 | 0.008 |
| discount-cents | 0/1 (0.0%) | 111 / 200 | 0.008 |
| free-shipping | 0/1 (0.0%) | 0 / 200 | 0.004 |
| iso-date | 0/1 (0.0%) | 9 / 200 | 0.005 |
| option-default | 0/1 (0.0%) | 0 / 200 | 0.004 |
| page-offset | 0/1 (0.0%) | 0 / 200 | 0.006 |
| phone-prefix | 0/1 (0.0%) | 128 / 200 | 0.006 |
| query-value | 0/1 (0.0%) | 0 / 200 | 0.005 |
| unicode-slug | 0/1 (0.0%) | 0 / 200 | 0.003 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
