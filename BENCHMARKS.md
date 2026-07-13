# Benchmarks

Generated with `bun run benchmark` on 2026-07-13T16:37:24.692Z.

This benchmark is offline and reproducible. It runs the same 25 checked-in coding prompts from `benchmarks/tasks.json` three times with pruning/cache disabled, then enabled. Token counts use the project tokenizer; costs are estimated with `gpt-4o-mini` rates from the local cost calculator. These are not live API bills.

| Run | Tokens off | Tokens on | Token reduction | Cost off | Cost on | Cost reduction | Time off ms | Time on ms | Cache hit rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 807,739 | 60,699 | 92.5% | $0.122241 | $0.010185 | 91.7% | 1263.50 | 914.94 | 0.0% |
| 2 | 807,739 | 60,699 | 92.5% | $0.122241 | $0.010185 | 91.7% | 879.84 | 1433.90 | 0.0% |
| 3 | 807,739 | 60,699 | 92.5% | $0.122241 | $0.010185 | 91.7% | 1279.86 | 1441.13 | 0.0% |

## Averages

| Metric | Off | On | Delta |
| --- | ---: | ---: | ---: |
| Tokens | 807,739 | 60,699 | 92.5% reduction |
| Estimated cost | $0.122241 | $0.010185 | 91.7% reduction |
| Wall-clock time | 1141.07 ms | 1263.32 ms | -16.0% reduction |
| Cache hit rate | 0.0% | 0.0% | +0.0% |

## Raw Data

Raw machine-readable output is checked in at `benchmarks/raw-data.json`.
