// Lint guards the deterministic core's rules (see src/game/README.md). Style is left to the editor.
import tseslint from 'typescript-eslint';

const ENGINE_MATH = 'Math.sin/cos/tan/exp/atan2/hypot and friends may differ in the last bit between browsers, which breaks replays recorded elsewhere. Use the deterministic versions in src/game/math.ts (import * as Det from \'.../math\').';
// Approximated by each engine (ECMAScript lets them differ); +, -, *, /, sqrt, round, floor, abs, min, max are exact everywhere.
const ENGINE_MATH_FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
    'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot'];

const NOT_DETERMINISTIC = 'The game core must be deterministic: take time from state.time/state.tick, randomness from state.rng (rng.ts), and keep browser APIs in the shell (main.ts, ui/).';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**'] },
    {
        files: ['src/game/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        rules: {
            'no-restricted-globals': ['error',
                ...['Date', 'performance', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'localStorage', 'sessionStorage', 'window', 'document', 'navigator', 'crypto']
                    .map(name => ({ name, message: NOT_DETERMINISTIC }))],
            'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: NOT_DETERMINISTIC },
                ...ENGINE_MATH_FUNCTIONS.map(property => ({ object: 'Math', property, message: ENGINE_MATH }))],
            // `a ** b` is Math.pow under another name.
            'no-restricted-syntax': ['error', { selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']", message: ENGINE_MATH }],
        },
    },
    {
        // The deterministic replacements themselves.
        files: ['src/game/math.ts'],
        rules: { 'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: NOT_DETERMINISTIC }] },
    },
    {
        // Decisions are pure: they get the values they need and return a result.
        files: ['src/game/**/decide.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [
                    { group: ['**/state', '**/state.ts'], message: 'decide.ts takes only the values it needs, not the whole game state. Write results in apply.ts.' },
                    { group: ['**/apply', '**/apply.ts'], message: 'decide.ts must not change state. Return a result and let apply.ts write it.' },
                ],
            }],
        },
    },
);
