# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case).

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| access-rule | 3/3 (100.0%) | 479 / 2000 | 8.398 |
| dedupe-order | 3/3 (100.0%) | 1119 / 2000 | 6.679 |
| discount-cents | 3/3 (100.0%) | 1009 / 2000 | 9.027 |
| free-shipping | 3/3 (100.0%) | 0 / 2000 | 5.718 |
| iso-date | 3/3 (100.0%) | 71 / 2000 | 11.779 |
| option-default | 1/3 (33.3%) | 0 / 2000 | 9.929 |
| page-offset | 0/3 (0.0%) | 1 / 2000 | 14.863 |
| phone-prefix | 3/3 (100.0%) | 1224 / 2000 | 7.844 |
| query-value | 3/3 (100.0%) | 2 / 2000 | 7.574 |
| unicode-slug | 3/3 (100.0%) | 0 / 2000 | 8.697 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
