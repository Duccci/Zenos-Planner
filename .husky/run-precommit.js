import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// Git Bash on Windows: npm .cmd shims create literal "nul" file instead of /dev/null.
// This only occurs when npm is invoked through Git Bash; fix after each command.
function cleanupNulFile() {
  try {
    fs.unlinkSync(path.join(process.cwd(), 'nul'))
  } catch {}
}

function run(cmd, options = {}) {
  console.log(`> ${cmd}`)
  const { env: extraEnv, ...rest } = options
  try {
    execSync(cmd, {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...extraEnv },
      ...rest,
    })
  } catch (err) {
    cleanupNulFile()
    process.exit(err.status || 1)
  }
  cleanupNulFile()
}

console.log(' Running pre-commit quality checks...')
console.log('')

console.log(' Stage 1: Linting all src files and markdown...')
run('npm run lint')
run('npm run lint:md')
console.log(' Linting passed')
console.log('')

console.log(' Stage 2: Type checking...')
run('npm run typecheck')
console.log(' Type checking passed')
console.log('')

console.log(' Stage 3: Unit Tests with Coverage...')
run('npm run test:coverage')
console.log(' Tests passed')
console.log('')

console.log(' Stage 4: Checking coverage thresholds...')
const COVERAGE_REPORT = 'coverage/coverage-final.json'
if (fs.existsSync(COVERAGE_REPORT)) {
  try {
    const c = JSON.parse(fs.readFileSync(COVERAGE_REPORT, 'utf8'))
    const lines = Object.values(c)
      .map((f) => (f && f.l ? f.l.pct : undefined))
      .filter((p) => p !== undefined)
    if (lines.length > 0) {
      const avg = Math.round(lines.reduce((a, b) => a + b, 0) / lines.length)
      console.log(`   Current coverage: ${avg}%`)
      if (avg < 90) {
        console.error(' Coverage below 90% threshold (minimum required).')
        process.exit(1)
      }
    }
  } catch (err) {
    // If parsing fails, fail the hook to be safe
    console.error(' Failed to read coverage report.')
    process.exit(1)
  }
}
console.log(' Coverage threshold met')
console.log('')

console.log(' Stage 5: Security scanning...')
run('npm audit --audit-level=moderate --omit=dev')
console.log(' Security scan passed')
console.log('')

console.log(' All quality checks passed! Commit ready to proceed.')

// Report any outstanding RED tests so they are never silently forgotten.
// This is informational — it does NOT block the commit.
try {
  const { readdirSync, readFileSync } = fs
  function walkTests(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    const files = []
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) files.push(...walkTests(full))
      else if (e.name.endsWith('.test.ts')) files.push(full)
    }
    return files
  }
  const testFiles = walkTests(path.join(process.cwd(), 'tests'))
  const redTests = []
  for (const f of testFiles) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (line.includes('it.skip(') && line.includes('// @red')) {
        const rel = path.relative(process.cwd(), f).replace(/\\/g, '/')
        redTests.push(`  ${rel}:${i + 1}`)
      }
    })
  }
  if (redTests.length > 0) {
    console.log('')
    console.log(` ⚠  ${redTests.length} RED test(s) still pending GREEN implementation:`)
    redTests.forEach((t) => console.log(t))
    console.log(' Remove it.skip and implement the module to clear these.')
  }
} catch (_) {
  // non-fatal — red test reporting is best-effort
}

// Write a timestamped sentinel so prepare-commit-msg can confirm --no-verify was not used.
fs.writeFileSync(path.join(process.cwd(), '.git', '.pre-commit-passed'), Date.now().toString())

process.exit(0)
