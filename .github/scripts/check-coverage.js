#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Read coverage threshold from .zeno config
const configPath = path.join(process.cwd(), 'zeno', '.zeno', 'config.json')
let threshold = 90 // default

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (config.qualityThresholds && config.qualityThresholds.codeCoverage) {
    threshold = config.qualityThresholds.codeCoverage
  }
} catch (err) {
  console.warn(`⚠️  Could not read .zeno config, using default threshold of ${threshold}%`)
}

// Read coverage report
const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json')
if (!fs.existsSync(coveragePath)) {
  console.error('❌ Coverage report not found at coverage/coverage-final.json')
  process.exit(1)
}

try {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
  const files = Object.values(coverage)

  const lineCoverage = files.map((f) => f.l?.pct).filter((p) => p !== undefined)

  if (lineCoverage.length === 0) {
    console.error('❌ No coverage data found')
    process.exit(1)
  }

  const avg = Math.round((lineCoverage.reduce((a, b) => a + b, 0) / lineCoverage.length) * 10) / 10

  console.log(`\n📊 Coverage Report`)
  console.log(`   Threshold: ${threshold}%`)
  console.log(`   Current:   ${avg}%`)

  if (avg < threshold) {
    console.error(`\n❌ Coverage ${avg}% is below threshold of ${threshold}%`)
    process.exit(1)
  }

  console.log(`\n✅ Coverage threshold met`)
  process.exit(0)
} catch (err) {
  console.error(`❌ Failed to parse coverage report: ${err.message}`)
  process.exit(1)
}
