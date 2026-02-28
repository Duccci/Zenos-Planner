export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 200],
    'body-max-line-length': [0],
    'subject-case': [2, 'never', ['start-case']],
    'subject-full-stop': [2, 'never', '.'],
  },
}
