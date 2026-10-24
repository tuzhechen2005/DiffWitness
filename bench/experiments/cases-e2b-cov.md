# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/cases. Coverage feedback: on.

Random baseline shapes: declared parameter types for 10 of 10 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| access-rule | 3/3 (100.0%) | 479 / 2000 | 9.800 |
| dedupe-order | 0/3 (0.0%) | 1119 / 2000 | 15.128 |
| discount-cents | 3/3 (100.0%) | 1009 / 2000 | 8.843 |
| free-shipping | 3/3 (100.0%) | 0 / 2000 | 5.737 |
| iso-date | 3/3 (100.0%) | 71 / 2000 | 9.122 |
| option-default | 3/3 (100.0%) | 0 / 2000 | 6.934 |
| page-offset | 3/3 (100.0%) | 1 / 2000 | 13.857 |
| phone-prefix | 3/3 (100.0%) | 1224 / 2000 | 7.437 |
| query-value | 3/3 (100.0%) | 2 / 2000 | 9.393 |
| unicode-slug | 3/3 (100.0%) | 0 / 2000 | 8.210 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
