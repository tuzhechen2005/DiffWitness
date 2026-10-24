# Refactor benchmark

Hypothesizer: gemma4:e4b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/hard. Coverage feedback: off.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| archived-access | 3/3 (100.0%) | 0 / 2000 | 15.232 |
| cached-sku-regex | 3/3 (100.0%) | 0 / 2000 | 17.462 |
| combining-key | 3/3 (100.0%) | 0 / 2000 | 16.839 |
| decimal-balance | 3/3 (100.0%) | 0 / 2000 | 18.712 |
| emoji-preview | 3/3 (100.0%) | 0 / 2000 | 18.279 |
| empty-role-selection | 3/3 (100.0%) | 0 / 2000 | 16.069 |
| half-cent-rounding | 2/3 (66.7%) | 0 / 2000 | 39.063 |
| large-sequence | 3/3 (100.0%) | 0 / 2000 | 27.644 |
| month-end-renewal | 3/3 (100.0%) | 0 / 2000 | 28.671 |
| premium-boundary | 3/3 (100.0%) | 0 / 2000 | 15.883 |
| unicode-casefold | 3/3 (100.0%) | 0 / 2000 | 24.906 |
| zero-direction | 3/3 (100.0%) | 0 / 2000 | 14.997 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
