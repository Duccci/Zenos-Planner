/**
 * Tests for Babel parser wrapper
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { parseFile, isParseable } from '../../src/analysis/parser.js';

describe('Parser Module', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseFile', () => {
    it('should parse valid JavaScript files', async () => {
      const jsFile = path.join(tempDir, 'test.js');
      await fs.writeFile(jsFile, 'const x = 42;\nexport default x;');

      const result = await parseFile(jsFile);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.ast?.type).toBe('File');
      expect(result.error).toBeUndefined();
    });

    it('should parse valid TypeScript files', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        tsFile,
        'interface MyInterface { x: number; }\nexport const y: MyInterface = { x: 1 };'
      );

      const result = await parseFile(tsFile);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.ast?.type).toBe('File');
    });

    it('should parse TypeScript with JSX', async () => {
      const tsxFile = path.join(tempDir, 'test.tsx');
      await fs.writeFile(
        tsxFile,
        'import React from "react";\nconst App = () => <div>Hello</div>;\nexport default App;'
      );

      const result = await parseFile(tsxFile);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    it('should handle syntax errors gracefully', async () => {
      const jsFile = path.join(tempDir, 'invalid.js');
      await fs.writeFile(jsFile, 'const x = {invalid syntax}');

      const result = await parseFile(jsFile);

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.length).toBeGreaterThan(0);
    });

    it('should handle non-existent files', async () => {
      const result = await parseFile('/non/existent/file.js');

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle TypeScript syntax errors', async () => {
      const tsFile = path.join(tempDir, 'invalid.ts');
      await fs.writeFile(
        tsFile,
        'interface Bad { x: number invalid }'
      );

      const result = await parseFile(tsFile);

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should resolve file paths to absolute paths', async () => {
      const jsFile = path.join(tempDir, 'test.js');
      await fs.writeFile(jsFile, 'const x = 1;');

      const result = await parseFile(jsFile);

      expect(result.filePath).toBe(path.resolve(jsFile));
    });

    it('should parse CommonJS code', async () => {
      const jsFile = path.join(tempDir, 'commonjs.js');
      await fs.writeFile(
        jsFile,
        'const utils = require("./utils");\nmodule.exports = { util: utils };'
      );

      const result = await parseFile(jsFile);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    it('should parse decorators', async () => {
      const tsFile = path.join(tempDir, 'decorators.ts');
      await fs.writeFile(
        tsFile,
        '@Component\nclass MyClass {\n  @Input() value: string;\n}'
      );

      const result = await parseFile(tsFile);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });
  });

  describe('isParseable', () => {
    it('should recognize TypeScript files', () => {
      expect(isParseable('file.ts')).toBe(true);
      expect(isParseable('file.tsx')).toBe(true);
    });

    it('should recognize JavaScript files', () => {
      expect(isParseable('file.js')).toBe(true);
      expect(isParseable('file.jsx')).toBe(true);
      expect(isParseable('file.mjs')).toBe(true);
      expect(isParseable('file.cjs')).toBe(true);
    });

    it('should reject non-source files', () => {
      expect(isParseable('file.json')).toBe(false);
      expect(isParseable('file.md')).toBe(false);
      expect(isParseable('file.html')).toBe(false);
      expect(isParseable('file.css')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isParseable('file.TS')).toBe(true);
      expect(isParseable('file.Tsx')).toBe(true);
      expect(isParseable('file.JS')).toBe(true);
    });
  });
});
