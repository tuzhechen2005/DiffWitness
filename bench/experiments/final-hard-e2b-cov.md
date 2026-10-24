# Refactor benchmark

Hypothesizer: gemma4:e2b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/hard. Coverage feedback: on.

Random baseline shapes: declared parameter types for 12 of 12 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| archived-access | 3/3 (100.0%) | 0 / 2000 | 7.763 |
| cached-sku-regex | 3/3 (100.0%) | 0 / 2000 | 9.391 |
| combining-key | 3/3 (100.0%) | 0 / 2000 | 7.610 |
| decimal-balance | 3/3 (100.0%) | 0 / 2000 | 10.552 |
| emoji-preview | 2/3 (66.7%) | 0 / 2000 | 12.599 |
| empty-role-selection | 3/3 (100.0%) | 0 / 2000 | 15.898 |
| half-cent-rounding | 2/3 (66.7%) | 0 / 2000 | 18.027 |
| large-sequence | 3/3 (100.0%) | 0 / 2000 | 10.335 |
| month-end-renewal | 3/3 (100.0%) | 0 / 2000 | 9.189 |
| premium-boundary | 2/3 (66.7%) | 0 / 2000 | 9.434 |
| unicode-casefold | 0/3 (0.0%) | 0 / 2000 | 20.106 |
| zero-direction | 2/3 (66.7%) | 0 / 2000 | 14.536 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
