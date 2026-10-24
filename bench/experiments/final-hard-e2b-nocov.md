# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/hard. Coverage feedback: off.

Random baseline shapes: declared parameter types for 12 of 12 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds | model errors |
| --- | --- | --- | --- | --- |
| archived-access | 3/3 (100.0%) | 0 / 2000 | 6.403 | 0 |
| cached-sku-regex | 3/3 (100.0%) | 0 / 2000 | 13.204 | 0 |
| combining-key | 3/3 (100.0%) | 0 / 2000 | 7.527 | 0 |
| decimal-balance | 3/3 (100.0%) | 0 / 2000 | 10.832 | 0 |
| emoji-preview | 1/3 (33.3%) | 0 / 2000 | 15.472 | 0 |
| empty-role-selection | 3/3 (100.0%) | 0 / 2000 | 6.815 | 0 |
| half-cent-rounding | 0/3 (0.0%) | 0 / 2000 | 28.434 | 0 |
| large-sequence | 2/3 (66.7%) | 0 / 2000 | 14.520 | 0 |
| month-end-renewal | 3/3 (100.0%) | 0 / 2000 | 10.310 | 0 |
| premium-boundary | 0/3 (0.0%) | 0 / 2000 | 13.737 | 0 |
| unicode-casefold | 0/3 (0.0%) | 0 / 2000 | 19.311 | 0 |
| zero-direction | 1/3 (33.3%) | 0 / 2000 | 19.388 | 0 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
