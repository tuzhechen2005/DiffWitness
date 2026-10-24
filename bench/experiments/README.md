# Experiment log

All runs: 3 runs per case, 2000 seeded random inputs per case, Gemma 4 via Ollama on an RTX 4060 laptop over LAN.

| file | model | coverage feedback | code |
| --- | --- | --- | --- |
| hard-e4b-cov.md, hard-e4b-nocov.md | gemma4:e4b | on / off | before type-aware filtering (#39) |
| cases-e2b-cov.md | gemma4:e2b | on | type filter without the single-array re-wrap: `dedupe-order` hypotheses were all dropped, so its 0/3 is an artifact |
| real-e4b-cov.md | gemma4:e4b | on | after #40 |
| hard-e2b-cov.md | gemma4:e2b | on | after #40, before the re-wrap |
| final-*.md | gemma4:e2b | on / off | final pipeline, commit b9afa5d (two files re-run after f9142da, which only added a retry and an errors column to the bench script); use these for the coverage ablation |
| ../results.md | gemma4:e4b | n/a | before coverage feedback and type filtering |
| ../results-e2b.md | gemma4:e2b | n/a | before coverage feedback and type filtering; superseded by final-cases-e2b-*.md |

The first-generation files were recorded while the pipeline was still changing, so compare runs only within the same row group.
