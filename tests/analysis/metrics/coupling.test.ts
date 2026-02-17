/**
 * Tests for coupling metrics calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateCoupling } from '../../../src/analysis/metrics/coupling.js';
import type { Module } from '../../../src/analysis/types.js';

describe('calculateCoupling', () => {
  const projectRoot = 'C:/tmp';

  it('calculates coupling for modules with no dependencies', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/a.ts`, {
        filePath: `${projectRoot}/a.ts`,
        relativePath: 'a.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
      [`${projectRoot}/b.ts`, {
        filePath: `${projectRoot}/b.ts`,
        relativePath: 'b.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    expect(result.modules.get(`${projectRoot}/a.ts`)!.afferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.efferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.instability).toBe(0);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.afferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.efferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.instability).toBe(0);
    expect(result.averageInstability).toBe(0);
    expect(result.highCoupling).toEqual([]);
  });

  it('calculates coupling for linear dependencies', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/a.ts`, {
        filePath: `${projectRoot}/a.ts`,
        relativePath: 'a.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './b', names: ['b'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/b.ts`, {
        filePath: `${projectRoot}/b.ts`,
        relativePath: 'b.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './c', names: ['c'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/c.ts`, {
        filePath: `${projectRoot}/c.ts`,
        relativePath: 'c.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    // a depends on b (efferent=1), nothing depends on a (afferent=0)
    expect(result.modules.get(`${projectRoot}/a.ts`)!.afferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.instability).toBe(1);

    // b depends on c (efferent=1), a depends on b (afferent=1)
    expect(result.modules.get(`${projectRoot}/b.ts`)!.afferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.instability).toBe(0.5);

    // c has no dependencies (efferent=0), b depends on c (afferent=1)
    expect(result.modules.get(`${projectRoot}/c.ts`)!.afferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/c.ts`)!.efferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/c.ts`)!.instability).toBe(0);

    expect(result.averageInstability).toBe((1 + 0.5 + 0) / 3);
    expect(result.highCoupling.map(module => module.filePath)).toEqual([
      `${projectRoot}/a.ts`,
    ]);
  });

  it('calculates coupling for hub modules', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/hub.ts`, {
        filePath: `${projectRoot}/hub.ts`,
        relativePath: 'hub.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [
            { source: './a', names: ['a'], isDefault: false, isDynamic: false },
            { source: './b', names: ['b'], isDefault: false, isDynamic: false }
          ], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/a.ts`, {
        filePath: `${projectRoot}/a.ts`,
        relativePath: 'a.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
      [`${projectRoot}/b.ts`, {
        filePath: `${projectRoot}/b.ts`,
        relativePath: 'b.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
      [`${projectRoot}/user1.ts`, {
        filePath: `${projectRoot}/user1.ts`,
        relativePath: 'user1.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './hub', names: ['hub'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/user2.ts`, {
        filePath: `${projectRoot}/user2.ts`,
        relativePath: 'user2.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './hub', names: ['hub'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    // hub depends on a and b (efferent=2), user1 and user2 depend on hub (afferent=2)
    expect(result.modules.get(`${projectRoot}/hub.ts`)!.afferent).toBe(2);
    expect(result.modules.get(`${projectRoot}/hub.ts`)!.efferent).toBe(2);
    expect(result.modules.get(`${projectRoot}/hub.ts`)!.instability).toBe(0.5);

    // a has no dependencies (efferent=0), hub depends on a (afferent=1)
    expect(result.modules.get(`${projectRoot}/a.ts`)!.afferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.efferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.instability).toBe(0);
    
    // user1 and user2 have instability=1.0 (>= 0.7), so they appear in highCoupling
    expect(result.highCoupling).toHaveLength(2);
    expect(result.highCoupling.some(m => m.filePath === `${projectRoot}/user1.ts`)).toBe(true);
    expect(result.highCoupling.some(m => m.filePath === `${projectRoot}/user2.ts`)).toBe(true);
  });

  it('ignores external dependencies', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/local.ts`, {
        filePath: `${projectRoot}/local.ts`,
        relativePath: 'local.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [
            { source: 'lodash', names: ['lodash'], isDefault: false, isDynamic: false },
            { source: './other', names: ['other'], isDefault: false, isDynamic: false }
          ], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/other.ts`, {
        filePath: `${projectRoot}/other.ts`,
        relativePath: 'other.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    // local depends only on other (not lodash), other has no dependencies
    expect(result.modules.get(`${projectRoot}/local.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/other.ts`)!.efferent).toBe(0);
    expect(result.modules.get(`${projectRoot}/other.ts`)!.afferent).toBe(1);
    expect(result.highCoupling.map(module => module.filePath)).toEqual([
      `${projectRoot}/local.ts`,
    ]);
  });

  it('calculates coupling for circular dependencies', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/a.ts`, {
        filePath: `${projectRoot}/a.ts`,
        relativePath: 'a.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './b', names: ['b'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/b.ts`, {
        filePath: `${projectRoot}/b.ts`,
        relativePath: 'b.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './a', names: ['a'], isDefault: false, isDynamic: false }], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    // Both have instability = 0.5 (1 dependency, 1 dependent)
    expect(result.modules.get(`${projectRoot}/a.ts`)!.afferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/a.ts`)!.instability).toBe(0.5);

    expect(result.modules.get(`${projectRoot}/b.ts`)!.afferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/b.ts`)!.instability).toBe(0.5);
  });

  it('calculates coupling with reexports', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/index.ts`, {
        filePath: `${projectRoot}/index.ts`,
        relativePath: 'index.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [{ source: './util', names: ['util'], isDefault: false, isDynamic: false }],
          exports: [], 
          reexports: []
        },
        linesOfCode: 5,
      }],
      [`${projectRoot}/util.ts`, {
        filePath: `${projectRoot}/util.ts`,
        relativePath: 'util.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);

    expect(result.modules.get(`${projectRoot}/index.ts`)!.efferent).toBe(1);
    expect(result.modules.get(`${projectRoot}/util.ts`)!.afferent).toBe(1);
  });

  it('handles empty modules map', () => {
    const modules = new Map<string, Module>();
    const result = calculateCoupling(modules);

    expect(result.modules.size).toBe(0);
    expect(result.averageInstability).toBe(0);
    expect(result.highCoupling).toEqual([]);
  });

  it('detects high instability threshold correctly', () => {
    const modules = new Map<string, Module>([
      [`${projectRoot}/unstable.ts`, {
        filePath: `${projectRoot}/unstable.ts`,
        relativePath: 'unstable.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { 
          imports: [
            { source: './a', names: ['a'], isDefault: false, isDynamic: false },
            { source: './b', names: ['b'], isDefault: false, isDynamic: false },
            { source: './c', names: ['c'], isDefault: false, isDynamic: false },
          ], 
          exports: [], 
          reexports: [] 
        },
        linesOfCode: 10,
      }],
      [`${projectRoot}/a.ts`, {
        filePath: `${projectRoot}/a.ts`,
        relativePath: 'a.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
      [`${projectRoot}/b.ts`, {
        filePath: `${projectRoot}/b.ts`,
        relativePath: 'b.ts', 
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
      [`${projectRoot}/c.ts`, {
        filePath: `${projectRoot}/c.ts`,
        relativePath: 'c.ts',
        extension: '.ts',
        ast: {} as any,
        dependencies: { imports: [], exports: [], reexports: [] },
        linesOfCode: 10,
      }],
    ]);

    const result = calculateCoupling(modules);
    
    // unstable.ts has instability = 1.0 (3 dependencies, 0 dependents)
    expect(result.modules.get(`${projectRoot}/unstable.ts`)!.instability).toBe(1.0);
    expect(result.highCoupling.some(m => m.filePath === `${projectRoot}/unstable.ts`)).toBe(true);
  });
});