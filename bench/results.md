# Refactor benchmark

Hypothesizer: gemma4:e4b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case).

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| access-rule | 3/3 (100.0%) | 479 / 2000 | 19.358 |
| dedupe-order | 3/3 (100.0%) | 1119 / 2000 | 15.654 |
| discount-cents | 3/3 (100.0%) | 1009 / 2000 | 40.322 |
| free-shipping | 3/3 (100.0%) | 0 / 2000 | 10.568 |
| iso-date | 3/3 (100.0%) | 71 / 2000 | 22.478 |
| option-default | 3/3 (100.0%) | 0 / 2000 | 14.796 |
| page-offset | 3/3 (100.0%) | 1 / 2000 | 19.748 |
| phone-prefix | 3/3 (100.0%) | 1224 / 2000 | 15.881 |
| query-value | 3/3 (100.0%) | 2 / 2000 | 16.395 |
| unicode-slug | 3/3 (100.0%) | 0 / 2000 | 18.411 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
