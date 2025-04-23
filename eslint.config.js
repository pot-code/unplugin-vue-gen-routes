import antfu from '@antfu/eslint-config'
import { globalIgnores } from 'eslint/config'

export default antfu({
  type: 'lib',
  stylistic: false,
  jsonc: false,
  rules: {
    'no-irregular-whitespace': 'off',
    'no-console': 'off',
    'unused-imports/no-unused-vars': 'warn',
    'antfu/if-newline': 'off',
    'prefer-const': 'warn',
    'node/prefer-global/process': 'off',
    'ts/explicit-function-return-type': 'off',
    'ts/no-explicit-any': 'off',
    'ts/no-unused-vars': 'warn',
    'ts/no-use-before-define': 'off',
  },
  ...globalIgnores(['./node_modules', './playground']),
})
