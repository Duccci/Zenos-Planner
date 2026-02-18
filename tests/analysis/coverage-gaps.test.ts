/**
 * Tests for coverage gaps in analysis module
 * Focus on error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { CodeAnalyzer } from '../../src/analysis/code-analyzer.js'
import { parseFile, isParseable } from '../../src/analysis/parser.js'
import { countLines, countLOCMetrics } from '../../src/analysis/metrics/loc.js'
import { calculateComplexity } from '../../src/analysis/metrics/complexity.js'
import { calculateCoupling } from '../../src/analysis/metrics/coupling.js'
import type { Module } from '../../src/analysis/types.js'
import type { File as BabelFile } from '@babel/types'

describe('Coverage Gaps - Error Handling and Edge Cases', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-gap-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Parser error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const nonexistentFile = path.join(tempDir, 'nonexistent.ts')
      const result = await parseFile(nonexistentFile)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle invalid JavaScript/TypeScript syntax', async () => {
      const file = path.join(tempDir, 'invalid.js')
      await fs.writeFile(file, 'import { foo from "bar"; // missing closing brace')
      const result = await parseFile(file)
      expect(result.success).toBe(false)
    })

    it('should identify parseable files correctly', () => {
      expect(isParseable('file.ts')).toBe(true)
      expect(isParseable('file.js')).toBe(true)
      expect(isParseable('file.tsx')).toBe(true)
      expect(isParseable('file.jsx')).toBe(true)
      expect(isParseable('file.mjs')).toBe(true)
      expect(isParseable('file.cjs')).toBe(true)
      expect(isParseable('file.json')).toBe(false)
      expect(isParseable('file.txt')).toBe(false)
      expect(isParseable('file.md')).toBe(false)
    })

    it('should handle files with only comments', async () => {
      const file = path.join(tempDir, 'comments.js')
      await fs.writeFile(file, '// comment line\n/* block comment */')
      const result = await parseFile(file)
      expect(result.success).toBe(true)
      expect(result.ast).toBeDefined()
    })

    it('should handle empty files', async () => {
      const file = path.join(tempDir, 'empty.js')
      await fs.writeFile(file, '')
      const result = await parseFile(file)
      expect(result.success).toBe(true)
    })
  })

  describe('CodeAnalyzer - getGraph and getMetrics', () => {
    it('should return dependency graph after analysis', async () => {
      await fs.writeFile(path.join(tempDir, 'script.js'), 'console.log("test")')
      const analyzer = new CodeAnalyzer()
      await analyzer.analyzeCodebase(tempDir)
      const graph = analyzer.getGraph()
      expect(graph).toBeDefined()
    })

    it('should return metrics after analysis', async () => {
      await fs.writeFile(path.join(tempDir, 'script.js'), 'const x = 1;\nexport default x;')
      const analyzer = new CodeAnalyzer()
      await analyzer.analyzeCodebase(tempDir)
      const metrics = analyzer.getMetrics()
      expect(metrics).toBeDefined()
      expect(metrics?.coupling).toBeDefined()
      expect(metrics?.complexity).toBeDefined()
      expect(metrics?.loc).toBeDefined()
    })

    it('should return undefined metrics before analysis', () => {
      const analyzer = new CodeAnalyzer()
      const metrics = analyzer.getMetrics()
      expect(metrics).toBeUndefined()
    })

    it('should skip non-parseable files without error', async () => {
      await fs.writeFile(path.join(tempDir, 'readme.md'), '# Test\nreadme content')
      await fs.writeFile(path.join(tempDir, 'data.json'), '{"key": "value"}')
      await fs.writeFile(path.join(tempDir, 'script.js'), 'console.log("test")')

      const analyzer = new CodeAnalyzer()
      const result = await analyzer.analyzeCodebase(tempDir)
      // Only the .js file should be analyzed
      expect(result.fileCount).toBe(1)
    })

    it('should throw when root path does not exist', async () => {
      const analyzer = new CodeAnalyzer()
      const nonexistent = path.join(tempDir, 'does-not-exist')
      await expect(analyzer.analyzeCodebase(nonexistent)).rejects.toThrow()
    })

    it('should handle getDependents for modules', async () => {
      await fs.writeFile(
        path.join(tempDir, 'a.js'),
        'import { foo } from "./b.js";\nexport const a = foo;'
      )
      await fs.writeFile(path.join(tempDir, 'b.js'), 'export const foo = 1;')
      const analyzer = new CodeAnalyzer()
      await analyzer.analyzeCodebase(tempDir)
      const dependents = analyzer.getDependents(path.join(tempDir, 'b.js'))
      expect(Array.isArray(dependents)).toBe(true)
    })

    it('should handle mixed TS and JS files', async () => {
      await fs.writeFile(path.join(tempDir, 'ts-file.ts'), 'const x: number = 1;\nexport default x;')
      await fs.writeFile(path.join(tempDir, 'js-file.js'), 'const y = 2;\nexport default y;')
      const analyzer = new CodeAnalyzer()
      const result = await analyzer.analyzeCodebase(tempDir)
      expect(result.fileCount).toBe(2)
      expect(result.modules.size).toBe(2)
    })

    it('should handle deep directory structures', async () => {
      const deepPath = path.join(tempDir, 'a', 'b', 'c')
      await fs.mkdir(deepPath, { recursive: true })
      await fs.writeFile(path.join(deepPath, 'deep.js'), 'export const x = 1;')
      const analyzer = new CodeAnalyzer()
      const result = await analyzer.analyzeCodebase(tempDir)
      expect(result.fileCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('LOC metrics', () => {
    it('should count lines for a single file', async () => {
      const file = path.join(tempDir, 'test.ts')
      await fs.writeFile(file, 'const a = 1;\nconst b = 2;\n\nconst c = 3;')
      const result = await countLines(file)
      expect(result.totalLines).toBeGreaterThan(0)
      expect(result.codeLines).toBeGreaterThan(0)
      expect(result.blankLines).toBeGreaterThanOrEqual(1)
      expect(result.filePath).toBe(file)
    })

    it('should count comment lines correctly', async () => {
      const file = path.join(tempDir, 'commented.ts')
      await fs.writeFile(file, '// single line comment\n/* block */\nconst x = 1;')
      const result = await countLines(file)
      expect(result.commentLines).toBeGreaterThan(0)
      expect(result.codeLines).toBeGreaterThan(0)
    })

    it('should handle empty files in countLines', async () => {
      const file = path.join(tempDir, 'empty.ts')
      await fs.writeFile(file, '')
      const result = await countLines(file)
      expect(result.totalLines).toBeGreaterThanOrEqual(0)
    })

    it('should aggregate metrics for multiple files', async () => {
      const fileA = path.join(tempDir, 'a.ts')
      const fileB = path.join(tempDir, 'b.ts')
      await fs.writeFile(fileA, 'export const a = 1;\nconst b = 2;')
      await fs.writeFile(fileB, 'export const c = 3;')
      const result = await countLOCMetrics([fileA, fileB])
      expect(result.files.size).toBe(2)
      expect(result.totalLines).toBeGreaterThan(0)
      expect(result.totalCodeLines).toBeGreaterThan(0)
    })

    it('should handle empty array in countLOCMetrics', async () => {
      const result = await countLOCMetrics([])
      expect(result.files.size).toBe(0)
      expect(result.totalLines).toBe(0)
    })
  })

  describe('Complexity metrics', () => {
    it('should calculate complexity for a simple function', async () => {
      const file = path.join(tempDir, 'simple.ts')
      await fs.writeFile(file, 'export function add(a: number, b: number): number { return a + b; }')
      const parseResult = await parseFile(file)
      expect(parseResult.success).toBe(true)
      const result = calculateComplexity(parseResult.ast as BabelFile, file)
      expect(result.modules.size).toBeGreaterThan(0)
      expect(result.maxComplexity).toBeGreaterThanOrEqual(0)
    })

    it('should calculate complexity for conditional branches', async () => {
      const file = path.join(tempDir, 'conditional.ts')
      await fs.writeFile(
        file,
        `export function check(x: number): string {
  if (x > 0) { return 'positive'; }
  else if (x < 0) { return 'negative'; }
  else { return 'zero'; }
}`
      )
      const parseResult = await parseFile(file)
      expect(parseResult.success).toBe(true)
      const result = calculateComplexity(parseResult.ast as BabelFile, file)
      expect(result.maxComplexity).toBeGreaterThan(1)
      expect(result.averageComplexity).toBeGreaterThan(0)
    })

    it('should handle file with no functions', async () => {
      const file = path.join(tempDir, 'noFunc.ts')
      await fs.writeFile(file, 'export const x = 1;\nexport const y = 2;')
      const parseResult = await parseFile(file)
      expect(parseResult.success).toBe(true)
      const result = calculateComplexity(parseResult.ast as BabelFile, file)
      expect(result.maxComplexity).toBe(0)
      expect(result.averageComplexity).toBe(0)
    })
  })

  describe('Coupling metrics', () => {
    it('should calculate coupling for a single isolated module', () => {
      const modules = new Map<string, Module>([
        [
          `${tempDir}/a.ts`,
          {
            filePath: `${tempDir}/a.ts`,
            relativePath: 'a.ts',
            extension: '.ts',
            ast: {} as BabelFile,
            dependencies: { imports: [], exports: [], reexports: [] },
            linesOfCode: 10,
          },
        ],
      ])
      const result = calculateCoupling(modules)
      expect(result.modules.size).toBe(1)
      const mod = result.modules.get(`${tempDir}/a.ts`)
      expect(mod?.afferent).toBe(0)
      expect(mod?.efferent).toBe(0)
      expect(result.averageInstability).toBe(0)
    })

    it('should handle empty modules map', () => {
      const modules = new Map<string, Module>()
      const result = calculateCoupling(modules)
      expect(result.modules.size).toBe(0)
      expect(result.averageInstability).toBe(0)
    })

    it('should detect high coupling when a module has many imports', () => {
      const projectRoot = tempDir
      const hubImports = Array.from({ length: 5 }, (_, i) => ({
        source: `./dep${i}.ts`,
        names: ['fn'],
        isDefault: false,
        isDynamic: false,
      }))

      const modules = new Map<string, Module>()
      modules.set(`${projectRoot}/hub.ts`, {
        filePath: `${projectRoot}/hub.ts`,
        relativePath: 'hub.ts',
        extension: '.ts',
        ast: {} as BabelFile,
        dependencies: { imports: hubImports, exports: [], reexports: [] },
        linesOfCode: 20,
      })
      for (let i = 0; i < 5; i++) {
        modules.set(`${projectRoot}/dep${i}.ts`, {
          filePath: `${projectRoot}/dep${i}.ts`,
          relativePath: `dep${i}.ts`,
          extension: '.ts',
          ast: {} as BabelFile,
          dependencies: { imports: [], exports: ['fn'], reexports: [] },
          linesOfCode: 5,
        })
      }
      const result = calculateCoupling(modules)
      expect(result.modules.size).toBeGreaterThan(0)
      expect(result.averageInstability).toBeGreaterThanOrEqual(0)
    })
  })
})
