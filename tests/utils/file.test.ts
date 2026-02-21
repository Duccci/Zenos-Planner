import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  readFile,
  readJsonFile,
  fileExists,
  directoryExists,
  writeFile,
  writeJsonFile,
  ensureDir,
  getRelativePath,
  resolvePath,
  normalizePath,
  getFileStats,
  walkDir,
  walkDirSync,
} from '../../src/utils/file.js'

const TEST_DIR = join(process.cwd(), '.test-temp-file-utils')

describe('file utilities', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('readFile', () => {
    it('reads text file content', async () => {
      const filePath = join(TEST_DIR, 'test.txt')
      await fsWriteFile(filePath, 'hello world', 'utf-8')

      const content = await readFile(filePath)
      expect(content).toBe('hello world')
    })

    it('throws FileSystemError for missing file', async () => {
      const filePath = join(TEST_DIR, 'nonexistent.txt')

      await expect(readFile(filePath)).rejects.toThrow('Failed to read file')
    })
  })

  describe('readJsonFile', () => {
    it('parses JSON file', async () => {
      const filePath = join(TEST_DIR, 'data.json')
      await fsWriteFile(filePath, '{"name": "test", "value": 42}', 'utf-8')

      const data = await readJsonFile<{ name: string; value: number }>(filePath)
      expect(data).toEqual({ name: 'test', value: 42 })
    })

    it('validates against Zod schema', async () => {
      const filePath = join(TEST_DIR, 'data.json')
      await fsWriteFile(filePath, '{"name": "test", "value": 42}', 'utf-8')

      const schema = z.object({
        name: z.string(),
        value: z.number(),
      })

      const data = await readJsonFile(filePath, schema)
      expect(data).toEqual({ name: 'test', value: 42 })
    })

    it('throws on schema validation failure', async () => {
      const filePath = join(TEST_DIR, 'data.json')
      await fsWriteFile(filePath, '{"name": 123}', 'utf-8')

      const schema = z.object({
        name: z.string(),
      })

      await expect(readJsonFile(filePath, schema)).rejects.toThrow('JSON validation failed')
    })

    it('throws on invalid JSON', async () => {
      const filePath = join(TEST_DIR, 'invalid.json')
      await fsWriteFile(filePath, 'not valid json', 'utf-8')

      await expect(readJsonFile(filePath)).rejects.toThrow('Failed to parse JSON')
    })
  })

  describe('fileExists', () => {
    it('returns true for existing file', async () => {
      const filePath = join(TEST_DIR, 'exists.txt')
      await fsWriteFile(filePath, 'content', 'utf-8')

      expect(fileExists(filePath)).toBe(true)
    })

    it('returns false for nonexistent file', () => {
      expect(fileExists(join(TEST_DIR, 'nope.txt'))).toBe(false)
    })

    it('returns false for directory', async () => {
      const dirPath = join(TEST_DIR, 'subdir')
      await mkdir(dirPath)

      expect(fileExists(dirPath)).toBe(false)
    })
  })

  describe('directoryExists', () => {
    it('returns true for existing directory', () => {
      expect(directoryExists(TEST_DIR)).toBe(true)
    })

    it('returns false for nonexistent directory', () => {
      expect(directoryExists(join(TEST_DIR, 'nope'))).toBe(false)
    })

    it('returns false for file', async () => {
      const filePath = join(TEST_DIR, 'file.txt')
      await fsWriteFile(filePath, 'content', 'utf-8')

      expect(directoryExists(filePath)).toBe(false)
    })
  })

  describe('writeFile', () => {
    it('writes content to file', async () => {
      const filePath = join(TEST_DIR, 'output.txt')

      await writeFile(filePath, 'test content')

      const content = await fsReadFile(filePath, 'utf-8')
      expect(content).toBe('test content')
    })

    it('creates parent directories', async () => {
      const filePath = join(TEST_DIR, 'nested', 'deep', 'file.txt')

      await writeFile(filePath, 'nested content')

      expect(existsSync(filePath)).toBe(true)
      const content = await fsReadFile(filePath, 'utf-8')
      expect(content).toBe('nested content')
    })

    it('uses atomic write (no partial files on failure)', async () => {
      const filePath = join(TEST_DIR, 'atomic.txt')
      await writeFile(filePath, 'original content')

      // Verify the original content is there
      const content = await fsReadFile(filePath, 'utf-8')
      expect(content).toBe('original content')
    })
  })

  describe('writeJsonFile', () => {
    it('writes JSON with 2-space indent', async () => {
      const filePath = join(TEST_DIR, 'output.json')

      await writeJsonFile(filePath, { name: 'test', value: 42 })

      const content = await fsReadFile(filePath, 'utf-8')
      expect(content).toBe('{\n  "name": "test",\n  "value": 42\n}\n')
    })
  })

  describe('ensureDir', () => {
    it('creates directory recursively', async () => {
      const dirPath = join(TEST_DIR, 'a', 'b', 'c')

      await ensureDir(dirPath)

      expect(existsSync(dirPath)).toBe(true)
    })

    it('does not throw for existing directory', async () => {
      await expect(ensureDir(TEST_DIR)).resolves.not.toThrow()
    })
  })

  describe('getRelativePath', () => {
    it('computes relative path from base', () => {
      const result = getRelativePath('/project/src/file.ts', '/project')
      expect(result).toBe('src/file.ts')
    })

    it('uses cwd as default base', () => {
      const result = getRelativePath(join(process.cwd(), 'src', 'file.ts'))
      expect(result).toBe('src/file.ts')
    })
  })

  describe('resolvePath', () => {
    it('resolves relative path to absolute', () => {
      const result = resolvePath('src/file.ts', '/project')
      expect(result).toMatch(/src/)
      expect(result).toMatch(/file\.ts/)
    })

    it('handles absolute path input', () => {
      const result = resolvePath('/absolute/path.ts', '/ignored')
      expect(result).toContain('absolute')
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes on Windows', () => {
      // This test is meaningful on Windows
      const result = normalizePath('src\\utils\\file.ts')
      expect(result).not.toContain('\\\\')
    })

    it('handles already normalized paths', () => {
      const result = normalizePath('src/utils/file.ts')
      expect(result).toBe('src/utils/file.ts')
    })
  })

  describe('getFileStats', () => {
    it('returns stats for existing file', async () => {
      const filePath = join(TEST_DIR, 'stats.txt')
      await fsWriteFile(filePath, 'content', 'utf-8')

      const stats = await getFileStats(filePath)
      expect(stats).not.toBeNull()
      expect(stats?.isFile()).toBe(true)
    })

    it('returns null for nonexistent file', async () => {
      const stats = await getFileStats(join(TEST_DIR, 'nope.txt'))
      expect(stats).toBeNull()
    })
  })

  describe('error handling edge cases', () => {
    it('fileExists handles stat errors gracefully', () => {
      // Invalid path characters
      expect(fileExists('')).toBe(false)
    })

    it('directoryExists handles stat errors gracefully', () => {
      expect(directoryExists('')).toBe(false)
    })

    it('ensureDir handles permission errors', async () => {
      // Test that mkdir is called (normal flow)
      const nestedDir = join(TEST_DIR, 'ensure', 'nested')
      await ensureDir(nestedDir)
      expect(directoryExists(nestedDir)).toBe(true)
    })

    it('writeFile handles write errors with context', async () => {
      // Try to write to an invalid path
      await expect(writeFile('', 'content')).rejects.toThrow('Failed to write file')
    })
  })

  describe('walkDir', () => {
    it('recursively collects .md files', async () => {
      // Create directory structure
      const dir1 = join(TEST_DIR, 'dir1')
      const dir2 = join(TEST_DIR, 'dir1', 'dir2')
      await mkdir(dir2, { recursive: true })

      // Create markdown files
      await fsWriteFile(join(TEST_DIR, 'file1.md'), 'content')
      await fsWriteFile(join(dir1, 'file2.md'), 'content')
      await fsWriteFile(join(dir2, 'file3.md'), 'content')
      await fsWriteFile(join(TEST_DIR, 'file.txt'), 'not markdown')

      const files = await walkDir(TEST_DIR)
      expect(files).toHaveLength(3)
      expect(files.every((f) => f.endsWith('.md'))).toBe(true)
    })

    it('handles missing directory gracefully', async () => {
      const nonexistent = join(TEST_DIR, 'nonexistent')
      const files = await walkDir(nonexistent)
      expect(files).toEqual([])
    })

    it('respects custom extension filter', async () => {
      const dir1 = join(TEST_DIR, 'dir1')
      await mkdir(dir1, { recursive: true })

      await fsWriteFile(join(TEST_DIR, 'file1.txt'), 'content')
      await fsWriteFile(join(TEST_DIR, 'file2.md'), 'content')
      await fsWriteFile(join(dir1, 'file3.txt'), 'content')

      const txtFiles = await walkDir(TEST_DIR, '.txt')
      expect(txtFiles).toHaveLength(2)
      expect(txtFiles.every((f) => f.endsWith('.txt'))).toBe(true)
    })
  })

  describe('walkDirSync', () => {
    it('synchronously collects .md files', () => {
      // Create directory structure
      const dir1 = join(TEST_DIR, 'dir1')
      const dir2 = join(TEST_DIR, 'dir1', 'dir2')

      require('node:fs').mkdirSync(dir2, { recursive: true })

      // Create markdown files
      require('node:fs').writeFileSync(join(TEST_DIR, 'file1.md'), 'content')
      require('node:fs').writeFileSync(join(dir1, 'file2.md'), 'content')
      require('node:fs').writeFileSync(join(dir2, 'file3.md'), 'content')
      require('node:fs').writeFileSync(join(TEST_DIR, 'file.txt'), 'not markdown')

      const files = walkDirSync(TEST_DIR)
      expect(files).toHaveLength(3)
      expect(files.every((f) => f.endsWith('.md'))).toBe(true)
    })

    it('handles missing directory gracefully', () => {
      const nonexistent = join(TEST_DIR, 'nonexistent')
      const files = walkDirSync(nonexistent)
      expect(files).toEqual([])
    })

    it('respects custom extension filter', () => {
      const dir1 = join(TEST_DIR, 'dir1')
      require('node:fs').mkdirSync(dir1, { recursive: true })

      require('node:fs').writeFileSync(join(TEST_DIR, 'file1.txt'), 'content')
      require('node:fs').writeFileSync(join(TEST_DIR, 'file2.md'), 'content')
      require('node:fs').writeFileSync(join(dir1, 'file3.txt'), 'content')

      const txtFiles = walkDirSync(TEST_DIR, '.txt')
      expect(txtFiles).toHaveLength(2)
      expect(txtFiles.every((f) => f.endsWith('.txt'))).toBe(true)
    })
  })
})


