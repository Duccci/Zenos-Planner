import fs from 'fs'
import path from 'path'

// prepare-commit-msg args: $1=msg-file, $2=commit-source, $3=sha1
// commit-source values: message, template, merge, squash, commit (amend)
const commitType = process.argv[2]

// Merge and squash commits bypass pre-commit normally — allow them.
if (commitType === 'merge' || commitType === 'squash') {
  process.exit(0)
}

const sentinelPath = path.join(process.cwd(), '.git', '.pre-commit-passed')

if (!fs.existsSync(sentinelPath)) {
  console.error('')
  console.error('ERROR: --no-verify is not allowed in this repository.')
  console.error('All quality checks must pass before committing.')
  console.error('Remove --no-verify and fix any issues reported by the pre-commit hook.')
  console.error('')
  process.exit(1)
}

// Reject stale sentinels (older than 5 minutes) to prevent --no-verify bypass
// via a sentinel left over from a previous commit.
const MAX_AGE_MS = 5 * 60 * 1000
const ts = parseInt(fs.readFileSync(sentinelPath, 'utf8').trim(), 10)
if (isNaN(ts) || Date.now() - ts > MAX_AGE_MS) {
  fs.unlinkSync(sentinelPath)
  console.error('')
  console.error('ERROR: Pre-commit checks have not been run for this commit.')
  console.error('Run: git commit (without --no-verify) to execute quality checks.')
  console.error('')
  process.exit(1)
}

// Sentinel is valid — consume it.
try {
  fs.unlinkSync(sentinelPath)
} catch {}

process.exit(0)
