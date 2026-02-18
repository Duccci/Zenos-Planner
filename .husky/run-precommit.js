import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// On Windows, npm .cmd shims contain `2>NUL` redirects. When Git Bash
// invokes these shims, the redirect creates a literal file named "nul"
// instead of using the Windows NUL device. Clean it up after each command.
function cleanupNulFile() {
  try { fs.unlinkSync(path.join(process.cwd(), 'nul')); } catch {}
}

function run(cmd, options = {}) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, ...options });
  } catch (err) {
    cleanupNulFile();
    process.exit(err.status || 1);
  }
  cleanupNulFile();
}

console.log(' Running pre-commit quality checks...');
console.log('');

console.log(' Stage 1: Formatting staged files...');
run('npx lint-staged');
console.log(' Linting passed');
console.log('');

console.log(' Stage 2: Type checking...');
run('npm run typecheck');
console.log(' Type checking passed');
console.log('');

console.log(' Stage 3: Unit Tests with Coverage...');
run('npm run test:coverage');
console.log(' Tests passed');
console.log('');

console.log(' Stage 4: Checking coverage thresholds...');
const COVERAGE_REPORT = 'coverage/coverage-final.json';
if (fs.existsSync(COVERAGE_REPORT)) {
  try {
    const c = JSON.parse(fs.readFileSync(COVERAGE_REPORT, 'utf8'));
    const lines = Object.values(c)
      .map((f) => (f && f.l ? f.l.pct : undefined))
      .filter((p) => p !== undefined);
    if (lines.length > 0) {
      const avg = Math.round(lines.reduce((a, b) => a + b, 0) / lines.length);
      console.log(`   Current coverage: ${avg}%`);
      if (avg < 90) {
        console.error(' Coverage below 90% threshold (minimum required).');
        process.exit(1);
      }
    }
  } catch (err) {
    // If parsing fails, fail the hook to be safe
    console.error(' Failed to read coverage report.');
    process.exit(1);
  }
}
console.log(' Coverage threshold met');
console.log('');

console.log(' Stage 5: Security scanning...');
run('npm audit --audit-level=moderate --omit=dev');
console.log(' Security scan passed');
console.log('');

console.log(' All quality checks passed! Commit ready to proceed.');
process.exit(0);
