import fs from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('No commit message file path provided.');
  process.exit(1);
}

const msg = fs.readFileSync(file, 'utf8');
const pattern = /^(feat|fix|refactor|docs|test|chore|perf|style)(\(.+\))?!?: .{1,72}/;

if (!pattern.test(msg)) {
  console.error('Commit message format is invalid');
  console.error('');
  console.error('Format: <type>(<scope>): <subject>');
  console.error('');
  console.error('Type must be one of:');
  console.error('  feat     - A new feature');
  console.error('  fix      - A bug fix');
  console.error('  refactor - Code refactoring');
  console.error('  docs     - Documentation changes');
  console.error('  test     - Test additions/modifications');
  console.error('  chore    - Build/dependency updates');
  console.error('  perf     - Performance improvements');
  console.error('  style    - Code style changes');
  console.error('');
  console.error('Example: feat(api): add user authentication endpoint');
  console.error('');
  process.exit(1);
}

process.exit(0);
