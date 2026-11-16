import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

const ENGINE_MATH =
    "Math.sin/cos/tan/exp/atan2/hypot and friends may differ in the last bit between browsers, which breaks replays recorded elsewhere. Use the deterministic versions in src/game/math.ts (import * as Det from '.../math').";
// Engine-approximated Math functions can break cross-browser replay
// determinism.
const ENGINE_MATH_FUNCTIONS = [
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'atan2',
    'sinh',
    'cosh',
    'tanh',
    'asinh',
    'acosh',
    'atanh',
    'exp',
    'expm1',
    'log',
    'log1p',
    'log2',
    'log10',
    'pow',
    'cbrt',
    'hypot',
];

const NOT_DETERMINISTIC =
    'The game core must be deterministic: take time from state.time/state.tick, randomness from state.rng (rng.ts), and keep browser APIs in the shell (main.ts, ui/).';

export default tseslint.config(
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
        rules: {
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
        },
    },
    {
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            '@stylistic': stylistic,
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            curly: ['error', 'multi-line'],
            'object-shorthand': ['error', 'always'],
            '@stylistic/max-statements-per-line': ['error', { max: 1 }],
            '@stylistic/max-len': [
                'error',
                {
                    code: 80,
                    tabWidth: 4,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreRegExpLiterals: true,
                },
            ],
        },
    },
    {
        files: ['src/**/*.ts', 'vite.config.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/array-type': [
                'error',
                { default: 'array-simple' },
            ],
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { args: 'none', varsIgnorePattern: '^_' },
            ],
        },
    },
    { ignores: ['dist/**', 'node_modules/**'] },
    {
        files: ['src/game/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        rules: {
            'no-restricted-globals': [
                'error',
                ...[
                    'Date',
                    'performance',
                    'requestAnimationFrame',
                    'setTimeout',
                    'setInterval',
                    'localStorage',
                    'sessionStorage',
                    'window',
                    'document',
                    'navigator',
                    'crypto',
                ].map((name) => ({ name, message: NOT_DETERMINISTIC })),
            ],
            'no-restricted-properties': [
                'error',
                {
                    object: 'Math',
                    property: 'random',
                    message: NOT_DETERMINISTIC,
                },
                ...ENGINE_MATH_FUNCTIONS.map((property) => ({
                    object: 'Math',
                    property,
                    message: ENGINE_MATH,
                })),
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
                    message: ENGINE_MATH,
                },
            ],
        },
    },
    {
        files: ['src/game/math.ts'],
        rules: {
            'no-restricted-properties': [
                'error',
                {
                    object: 'Math',
                    property: 'random',
                    message: NOT_DETERMINISTIC,
                },
            ],
        },
    },
    {
        files: ['src/game/**/decide.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/state', '**/state.ts'],
                            message:
                                'decide.ts takes only the values it needs, not the whole game state. Write results in apply.ts.',
                        },
                        {
                            group: ['**/apply', '**/apply.ts'],
                            message:
                                'decide.ts must not change state. Return a result and let apply.ts write it.',
                        },
                    ],
                },
            ],
        },
    },
);
