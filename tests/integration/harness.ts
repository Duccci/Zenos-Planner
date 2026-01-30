/**
 * Integration Test Harness
 *
 * Provides utilities for setting up and tearing down integration tests,
 * mocking user input, database management, and file system operations.
 */

import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

export class TestHarness {
  private tempDir: string
  private originalCwd: string
  private databases: Map<string, any> = new Map()

  constructor() {
    this.tempDir = path.join(tmpdir(), 'zeno-integration-' + Math.random().toString(36).substr(2, 9))
    this.originalCwd = process.cwd()
  }

  /**
   * Set up test environment
   */
  async setup(): Promise<void> {
    // Create temp directory
    fs.mkdirSync(this.tempDir, { recursive: true })
    process.chdir(this.tempDir)

    // Initialize empty git repo for testing
    try {
      execSync('git init', { stdio: 'ignore' })
      execSync('git config user.name "Test User"', { stdio: 'ignore' })
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' })
    } catch (error) {
      // Git not available, skip
    }
  }

  /**
   * Tear down test environment
   */
  async teardown(): Promise<void> {
    // Close databases
    for (const [name, db] of this.databases) {
      try {
        // Close database connection if available
      } catch (error) {
        // Ignore
      }
    }
    this.databases.clear()

    // Restore original directory
    process.chdir(this.originalCwd)

    // Clean up temp directory
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true })
    }
  }

  /**
   * Copy fixture project to test directory
   */
  copyFixture(fixtureName: string): void {
    const fixturePath = path.join(__dirname, '../fixtures/projects', fixtureName)
    const destPath = path.join(this.tempDir, fixtureName)

    this.copyDirectory(fixturePath, destPath)
  }

  /**
   * Mock user input for interactive commands
   */
  mockUserInput(inputs: string[]): void {
    // In a real implementation, this would mock stdin
    // For now, this is a placeholder
  }

  /**
   * Assert file exists and has expected content
   */
  assertFileExists(filePath: string): void {
    const fullPath = path.join(this.tempDir, filePath)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Expected file ${filePath} does not exist`)
    }
  }

  /**
   * Assert directory exists
   */
  assertDirectoryExists(dirPath: string): void {
    const fullPath = path.join(this.tempDir, dirPath)
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      throw new Error(`Expected directory ${dirPath} does not exist`)
    }
  }

  /**
   * Assert file contains expected content
   */
  assertFileContains(filePath: string, expectedContent: string): void {
    const fullPath = path.join(this.tempDir, filePath)
    const content = fs.readFileSync(fullPath, 'utf-8')
    if (!content.includes(expectedContent)) {
      throw new Error(`File ${filePath} does not contain expected content: ${expectedContent}`)
    }
  }

  /**
   * Get full path in test directory
   */
  getPath(relativePath: string): string {
    return path.join(this.tempDir, relativePath)
  }

  /**
   * Register database for cleanup
   */
  registerDatabase(name: string, db: any): void {
    this.databases.set(name, db)
  }

  private copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(src)) {
      throw new Error(`Source directory ${src} does not exist`)
    }

    fs.mkdirSync(dest, { recursive: true })

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

/**
 * Create test harness instance
 */
export function createTestHarness(): TestHarness {
  return new TestHarness()
}

/**
 * Helper for running commands in test environment
 */
export function runCommand(command: string, options: { cwd?: string } = {}): { stdout: string, stderr: string, exitCode: number } {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      cwd: options.cwd,
      stdio: 'pipe'
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1
    }
  }
}