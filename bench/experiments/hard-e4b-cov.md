# Refactor benchmark

Hypothesizer: gemma4:e4b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/hard. Coverage feedback: on.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| archived-access | 3/3 (100.0%) | 0 / 2000 | 22.078 |
| cached-sku-regex | 3/3 (100.0%) | 0 / 2000 | 17.543 |
| combining-key | 3/3 (100.0%) | 0 / 2000 | 14.414 |
| decimal-balance | 3/3 (100.0%) | 0 / 2000 | 19.691 |
| emoji-preview | 3/3 (100.0%) | 0 / 2000 | 19.266 |
| empty-role-selection | 3/3 (100.0%) | 0 / 2000 | 34.917 |
| half-cent-rounding | 2/3 (66.7%) | 0 / 2000 | 34.492 |
| large-sequence | 3/3 (100.0%) | 0 / 2000 | 20.847 |
| month-end-renewal | 3/3 (100.0%) | 0 / 2000 | 23.797 |
| premium-boundary | 3/3 (100.0%) | 0 / 2000 | 18.270 |
| unicode-casefold | 2/3 (66.7%) | 0 / 2000 | 49.456 |
| zero-direction | 3/3 (100.0%) | 0 / 2000 | 17.585 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
