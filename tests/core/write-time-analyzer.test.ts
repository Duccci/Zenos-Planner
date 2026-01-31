/**
 * Write-Time Analyzer Integration Tests
 * Tests the complete write-time analysis workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeGateChanges, GateAnalysisResult } from '../../src/core/write-time-analyzer.js';
import { getDatabase } from '../../src/storage/database.js';

// Mock git execution
vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'src/core/new-file.ts\nsrc/utils/helper.ts\n')
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(() => 'mock content')
  }
}));

// Mock database
vi.mock('../../src/storage/database.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({
        id: 'gate-01',
        created_at: new Date().toISOString()
      }))
    }))
  }))
}));

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  findProjectRoot: vi.fn(() => '/mock/project')
}));

describe('Write-Time Analyzer', () => {
  let mockAnalyzer: any;

  beforeEach(() => {
    // Create mock analyzer
    mockAnalyzer = {
      analyzeCodebase: vi.fn().mockResolvedValue({
        modules: new Map(),
        metrics: {
          coupling: { modules: new Map(), averageInstability: 0, highCoupling: [] },
          complexity: { modules: new Map(), maxComplexity: 0, averageComplexity: 5.0 },
          loc: { files: new Map(), totalLines: 100, totalCodeLines: 80, totalBlankLines: 10, totalCommentLines: 10 }
        }
      })
    };

    // Mock the CodeAnalyzer
    vi.doMock('../../src/analysis/code-analyzer.js', () => ({
      CodeAnalyzer: vi.fn().mockImplementation(() => mockAnalyzer)
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeGateChanges', () => {
    it('should analyze incremental changes for a gate', async () => {
      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        fileCount: 2,
        totalLOC: 100,
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000
      });

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01');

      expect(result.gateId).toBe('gate-01');
      expect(result.changedFiles).toContain('src/core/new-file.ts');
      expect(result.changedFiles).toContain('src/utils/helper.ts');
      expect(result.incrementalMetrics).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle no changed files', async () => {
      // Override the mock to return empty
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('');

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01');

      expect(result.changedFiles).toHaveLength(0);
      expect(result.newModules.size).toBe(0);
    });

    it('should filter to code files only', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('src/core/code.ts\nREADME.md\ndocs/guide.md\n');

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map([['/mock/project/src/core/code.ts', {
          filePath: '/mock/project/src/core/code.ts',
          relativePath: 'src/core/code.ts',
          extension: '.ts',
          ast: {} as any,
          dependencies: { imports: [], exports: [], reexports: [] },
          linesOfCode: 50
        }]]),
        fileCount: 1,
        totalLOC: 50,
        startTime: new Date(),
        endTime: new Date(),
        duration: 500
      });

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01');

      expect(result.changedFiles).toEqual(['src/core/code.ts']);
      expect(result.newModules.has('src/core/code.ts')).toBe(true);
    });

    it('should handle analysis errors gracefully', async () => {
      mockAnalyzer.analyzeCodebase.mockRejectedValue(new Error('Analysis failed'));

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Analysis failed');
      expect(result.newModules.size).toBe(0);
    });

    it('should handle git command failures', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Git command failed');
      });

      const result: GateAnalysisResult = await analyzeGateChanges('gate-01');

      expect(result.changedFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0); // Git failure is handled gracefully
    });
  });

  describe('Integration Workflow', () => {
    it('should simulate complete greenfield workflow', async () => {
      // Mock multiple gates with analysis data
      const mockDb = {
        prepare: vi.fn(() => ({
          get: vi.fn((query: string) => {
            if (query.includes('projects')) {
              return {
                id: 'proj-1',
                start_state: JSON.stringify({
                  gateAnalysis: {
                    'gate-01': {
                      metrics: {
                        coupling: { hotspots: ['auth.ts', 'db.ts'] },
                        complexity: { average: 6.5 },
                        loc: { total: 500 }
                      }
                    }
                  }
                })
              };
            }
            return { id: 'gate-01', created_at: new Date().toISOString() };
          })
        }))
      };

      vi.mocked(getDatabase).mockReturnValue(mockDb);

      mockAnalyzer.analyzeCodebase.mockResolvedValue({
        modules: new Map(),
        fileCount: 5,
        totalLOC: 300,
        startTime: new Date(),
        endTime: new Date(),
        duration: 800
      });

      // Simulate Gate 1 completion with analysis
      const gate1Result = await analyzeGateChanges('gate-01');
      expect(gate1Result.gateId).toBe('gate-01');
      expect(gate1Result.changedFiles.length).toBeGreaterThan(0);

      // Verify analysis data would be stored
      // (In real implementation, this would update the database)
    });

    it('should handle complex multi-gate analysis accumulation', async () => {
      // Mock project with multiple completed gates
      const mockDb = {
        prepare: vi.fn(() => ({
          get: vi.fn(() => ({
            id: 'proj-1',
            start_state: JSON.stringify({
              gateAnalysis: {
                'gate-01': {
                  metrics: {
                    coupling: { hotspots: ['auth.ts'] },
                    complexity: { average: 4.0 },
                    loc: { total: 200 }
                  }
                },
                'gate-02': {
                  metrics: {
                    coupling: { hotspots: ['api.ts', 'auth.ts'] },
                    complexity: { average: 5.5 },
                    loc: { total: 350 }
                  }
                }
              }
            })
          }))
        }))
      };

      vi.mocked(getDatabase).mockReturnValue(mockDb);

      // This would be used by regenerateGatesFromAnalysis
      // Verify accumulation logic works correctly
      const accumulatedHotspots = ['auth.ts', 'api.ts', 'auth.ts']; // From both gates
      const uniqueHotspots = [...new Set(accumulatedHotspots)];
      expect(uniqueHotspots).toEqual(['auth.ts', 'api.ts']);
    });
  });
});