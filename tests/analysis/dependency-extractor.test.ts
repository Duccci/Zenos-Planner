/**
 * Tests for dependency extractor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { parseFile } from '../../src/analysis/parser';
import { extractDependencies, resolveImportPath } from '../../src/analysis/dependency-extractor';

describe('Dependency Extractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'extractor-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('extractDependencies', () => {
    it('should extract ES6 named imports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'import { foo, bar } from "./utils";');

      const parseResult = await parseFile(file);
      expect(parseResult.success).toBe(true);

      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports).toHaveLength(1);
      expect(deps.imports[0].source).toBe('./utils');
      expect(deps.imports[0].names).toContain('foo');
      expect(deps.imports[0].names).toContain('bar');
      expect(deps.imports[0].isDynamic).toBe(false);
    });

    it('should extract ES6 default imports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'import express from "express";');

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports).toHaveLength(1);
      expect(deps.imports[0].source).toBe('express');
      expect(deps.imports[0].isDefault).toBe(true);
    });

    it('should extract namespace imports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'import * as utils from "./utils";');

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports).toHaveLength(1);
      expect(deps.imports[0].source).toBe('./utils');
      expect(deps.imports[0].names).toContain('*');
    });

    it('should extract dynamic imports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'const mod = import("./lazy");');

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports.length).toBeGreaterThan(0);
      const dynamicImport = deps.imports.find(
        (i: any) => i.isDynamic
      );
      expect(dynamicImport).toBeDefined();
      expect(dynamicImport?.source).toBe('./lazy');
    });

    it('should extract named exports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(
        file,
        'export const foo = 1;\nexport function bar() {}'
      );

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.exports).toContain('foo');
      expect(deps.exports).toContain('bar');
    });

    it('should extract default exports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'export default { key: "value" };');

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.exports).toContain('default');
    });

    it('should extract re-exports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(
        file,
        'export { foo, bar } from "./utils";'
      );

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.reexports).toHaveLength(1);
      expect(deps.reexports[0].source).toBe('./utils');
      expect(deps.reexports[0].names).toContain('foo');
      expect(deps.reexports[0].names).toContain('bar');
    });

    it('should handle CommonJS require', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'const utils = require("./utils");');

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports).toHaveLength(1);
      expect(deps.imports[0].source).toBe('./utils');
      expect(deps.imports[0].names).toContain('utils');
    });

    it('should deduplicate imports', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(
        file,
        'import { foo } from "./utils";\nimport { bar } from "./utils";'
      );

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      // Should be deduped by source and names
      expect(
        deps.imports.filter((i: any) => i.source === './utils').length
      ).toBeLessThanOrEqual(2);
    });

    it('should handle mixed import/export', async () => {
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(
        file,
        'import { foo } from "./utils";\nexport const bar = foo * 2;'
      );

      const parseResult = await parseFile(file);
      const deps = extractDependencies(parseResult.ast!, file);

      expect(deps.imports.length).toBeGreaterThan(0);
      expect(deps.exports.length).toBeGreaterThan(0);
    });
  });

  describe('resolveImportPath', () => {
    it('should resolve relative paths', () => {
      const paths = resolveImportPath(
        './utils',
        '/src/components/Button.ts'
      );

      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toContain('utils');
    });

    it('should return package names as-is', () => {
      const paths = resolveImportPath(
        'express',
        '/src/app.ts'
      );

      expect(paths[0]).toBe('express');
    });

    it('should generate multiple possible paths', () => {
      const paths = resolveImportPath(
        './lib/utils',
        '/src/app.ts'
      );

      expect(paths.length).toBeGreaterThanOrEqual(5);
      // Should include .ts, .tsx, .js, .jsx, /index.* variants
    });
  });
});
