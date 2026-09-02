# Documentation Sources

| Source                                                 | Status                        | Use                                                            |
| ------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------- |
| HummusJS wiki (15-page snapshot)                       | Migrated and rewritten        | Source material for the low-level and how-to sections.         |
| `packages/native-with-source/README.md`                | Migrated                      | Installation, migration, and compatibility source material.    |
| `CHANGELOG.md`                                         | Canonical at repository root  | Current release history.                                       |
| `packages/native-core/lib/Recipe.js` and `lib/recipe/` | Primary implementation source | High-level Recipe behavior.                                    |
| `packages/native-core/muhammara.d.ts`                  | Secondary source              | Public TypeScript surface to reconcile with implementation.    |
| `packages/native-with-source/tests/`                   | Primary verification source   | Executable behavior and example candidates.                    |
| chunyenHuang/hummusRecipe                              | MIT-licensed source           | Recipe prose is independently rewritten from code and tests.   |
| GitHub issues and discussions                          | Reviewed backlog source       | Identify how-to needs; independently author and verify guides. |

The local legacy snapshot matches the complete upstream HummusJS wiki: 15 pages
were reviewed and rewritten into the sectioned documentation, then corrected
against the current code and tests. Community content is not republished by
default. The bundled Recipe implementation originates from the MIT-licensed
hummusRecipe project; current Recipe guides are authored from this repository's
implementation and tests rather than copied prose.
