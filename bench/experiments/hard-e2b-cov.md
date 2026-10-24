# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/hard. Coverage feedback: on.

Random baseline shapes: declared parameter types for 12 of 12 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| archived-access | 3/3 (100.0%) | 0 / 2000 | 13.242 |
| cached-sku-regex | 0/3 (0.0%) | 0 / 2000 | 20.392 |
| combining-key | 3/3 (100.0%) | 0 / 2000 | 10.138 |
| decimal-balance | 2/3 (66.7%) | 0 / 2000 | 9.334 |
| emoji-preview | 1/3 (33.3%) | 0 / 2000 | 16.295 |
| empty-role-selection | 3/3 (100.0%) | 0 / 2000 | 14.120 |
| half-cent-rounding | 2/3 (66.7%) | 0 / 2000 | 20.033 |
| large-sequence | 1/3 (33.3%) | 0 / 2000 | 21.953 |
| month-end-renewal | 3/3 (100.0%) | 0 / 2000 | 11.378 |
| premium-boundary | 2/3 (66.7%) | 0 / 2000 | 8.282 |
| unicode-casefold | 2/3 (66.7%) | 0 / 2000 | 19.768 |
| zero-direction | 1/3 (33.3%) | 0 / 2000 | 18.688 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
