# Refactor benchmark

Hypothesizer: gemma4:e4b @ http://192.168.1.110:11434. Runs per case: 3. Random seed: 1 (reset per case). Cases: bench/real. Coverage feedback: on.

Random baseline shapes: declared parameter types for 3 of 3 cases, the expected silent args otherwise.

| case | model silent hit rate | random silent hits / R | model avg seconds |
| --- | --- | --- | --- |
| query-prototype-type | 3/3 (100.0%) | 0 / 2000 | 40.993 |
| query-scalar-separator | 3/3 (100.0%) | 109 / 2000 | 18.530 |
| query-url-whitespace | 3/3 (100.0%) | 3 / 2000 | 19.596 |

Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.
