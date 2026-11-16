# Coding style

The project uses selected conventions from the [Google TypeScript style guide](https://google.github.io/styleguide/tsguide.html).
The executable rules are in [eslint.config.js](eslint.config.js).
Prettier owns whitespace and layout, with four-space indentation, single quotes, an 80-column target, and trailing commas.

## Errors

ESLint rejects these violations in application code:

| Area | Convention |
| --- | --- |
| Names | Variables use camelCase, PascalCase, or UPPER_CASE. Functions use camelCase or PascalCase. Parameters use camelCase. Types use PascalCase. |
| Type imports | Type-only imports use `import type`. |
| Type exports | Type-only exports use `export type`. |
| Assertions | Assertions use `as`. Object literals use annotations or `satisfies` instead of assertions. |
| Public functions | Exported functions declare their return types. Contextually typed functions retain the rule's default exceptions. |
| Import order | Built-in modules, external packages, internal paths, relative paths, then type imports. Each group has a blank line. Module paths sort alphabetically. |
| Import duplicates | Duplicate imports are rejected. A separate type import and value import from the same module are allowed. |
| Control flow | Every conditional and loop body has braces. A returning branch has no following `else`. |
| Declarations | Each variable declaration statement declares one variable. |

Property names retain external API contracts.
Short physics and geometry names such as `x`, `y`, `vx`, and `dt` are allowed.
Imports used only for side effects retain their execution order.
Game determinism, unsafe-value checks, and cycle detection remain errors.

The same applicable JavaScript rules cover scripts and tests.
TypeScript tests also use naming, type-import, assertion, and public-function rules.

## Size and complexity limits

These thresholds apply throughout the codebase:

| Rule | Threshold |
| --- | --- |
| `max-lines-per-function` | 100 lines, excluding blank lines and comments |
| `max-depth` | 4 nested blocks |
| `max-params` | 5 parameters |
| `complexity` | 15 |

All limits are errors. Both lint commands use `--max-warnings 0`, so any warning also fails the command.
Application code, drawing routines, scripts, and tests follow the same limits.
No directory has a blanket exemption.

## Commands

| Command | Result |
| --- | --- |
| `npm run lint` | Fails on errors and warnings. |
| `npm run lint:fix` | Applies supported ESLint fixes. |
| `npm run format` | Formats source, configuration, scripts, and tests. |
| `npm run format:check` | Checks formatting without changing files. |
| `npm run typecheck` | Checks application and tool types. |
| `npm test` | Runs behavior tests and checks that lint rejects invalid fixtures. |

CI runs the type, formatting, lint, test, and build checks.
