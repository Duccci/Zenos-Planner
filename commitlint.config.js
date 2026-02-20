export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'never', ['start-case']],
    'subject-full-stop': [2, 'never', '.'],
  },
}
