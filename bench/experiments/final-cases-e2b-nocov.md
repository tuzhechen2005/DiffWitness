# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/cases. Coverage feedback: off.

Random baseline shapes: declared parameter types for 10 of 10 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| access-rule | 3/3 (100.0%) | 479 / 2000 | 7.231 |
| dedupe-order | 3/3 (100.0%) | 1119 / 2000 | 7.033 |
| discount-cents | 3/3 (100.0%) | 1009 / 2000 | 12.476 |
| free-shipping | 3/3 (100.0%) | 0 / 2000 | 5.444 |
| iso-date | 3/3 (100.0%) | 71 / 2000 | 10.789 |
| option-default | 2/3 (66.7%) | 0 / 2000 | 11.023 |
| page-offset | 2/3 (66.7%) | 1 / 2000 | 14.446 |
| phone-prefix | 3/3 (100.0%) | 1224 / 2000 | 7.675 |
| query-value | 3/3 (100.0%) | 2 / 2000 | 8.205 |
| unicode-slug | 3/3 (100.0%) | 0 / 2000 | 8.128 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
