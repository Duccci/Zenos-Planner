/**
 * Gate Completion Analysis Integration Tests
 * End-to-end testing of gate completion with analysis workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { completeGate } from '../../src/core/completions.js';
import { analyzeGateChanges } from '../../src/core/write-time-analyzer.js';
import { regenerateGatesFromAnalysis } from '../../src/core/gate-generator.js';
import { getDatabase } from '../../src/storage/database.js';

// Mock all external dependencies
vi.mock('../../src/storage/database.js');
vi.mock('../../src/utils/config.js');
vi.mock('../../src/utils/file.js');
vi.mock('../../src/utils/gate-consolidation.js');
vi.mock('../../src/utils/git.js');
vi.mock('../../src/utils/version.js');
vi.mock('../../src/core/write-time-analyzer.js');
vi.mock('../../src/core/gate-generator.js');

describe('Gate Completion Analysis Integration', () => {
  let mockDb: any;
  let mockAnalyzeGateChanges: any;
  let mockRegenerateGatesFromAnalysis: any;

  beforeEach(() => {
    // Setup mocks
    mockDb = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({
          id: 'gate-01',
          name: 'Core Infrastructure',
          status: 'in_progress'
        })),
        run: vi.fn()
      })),
      transaction: vi.fn((fn) => fn('gate-01'))
    };

    mockAnalyzeGateChanges = vi.fn();
    mockRegenerateGatesFromAnalysis = vi.fn();

    vi.mocked(getDatabase).mockReturnValue(mockDb);
    vi.mocked(analyzeGateChanges).mockImplementation(mockAnalyzeGateChanges);
    vi.mocked(regenerateGatesFromAnalysis).mockImplementation(mockRegenerateGatesFromAnalysis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Gate with Analysis Workflow', () => {
    it('should complete gate and offer analysis option', async () => {
      // Mock successful gate completion
      mockAnalyzeGateChanges.mockResolvedValue({
        gateId: 'gate-01',
        changedFiles: ['src/core/auth.ts', 'src/core/db.ts'],
        incrementalMetrics: {
          coupling: { hotspots: ['auth.ts'] },
          complexity: { average: 4.2 },
          loc: { total: 150 }
        },
        analysisTime: 1200,
        errors: []
      });

      // Mock regeneration suggestions
      mockRegenerateGatesFromAnalysis.mockReturnValue({
        originalGates: [
          { id: 'gate-02', name: 'API Layer', estimatedComplexity: 25 }
        ],
        suggestedGates: [
          { id: 'gate-02', name: 'API Layer', estimatedComplexity: 25 }
        ],
        changes: [],
        reasoning: 'No significant issues detected'
      });

      const result = await completeGate('gate-01');

      expect(result.gateId).toBe('gate-01');
      expect(result.gateName).toBe('Core Infrastructure');
      expect(mockAnalyzeGateChanges).toHaveBeenCalledWith('gate-01');
    });

    it('should handle analysis errors gracefully', async () => {
      mockAnalyzeGateChanges.mockResolvedValue({
        gateId: 'gate-01',
        changedFiles: [],
        incrementalMetrics: {
          coupling: { hotspots: [] },
          complexity: { average: 0 },
          loc: { total: 0 }
        },
        analysisTime: 500,
        errors: ['Failed to parse some files']
      });

      const result = await completeGate('gate-01');

      expect(result.gateId).toBe('gate-01');
      expect(mockAnalyzeGateChanges).toHaveBeenCalledWith('gate-01');
      // Should still complete successfully despite analysis errors
    });

    it('should accumulate analysis data across multiple gates', async () => {
      // Mock project with existing analysis data
      mockDb.prepare.mockReturnValue({
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
              }
            }
          })
        }))
      });

      mockAnalyzeGateChanges.mockResolvedValue({
        gateId: 'gate-02',
        changedFiles: ['src/api/routes.ts'],
        incrementalMetrics: {
          coupling: { hotspots: ['routes.ts'] },
          complexity: { average: 3.8 },
          loc: { total: 120 }
        },
        analysisTime: 800,
        errors: []
      });

      await completeGate('gate-02');

      // Verify analysis data would be merged
      expect(mockAnalyzeGateChanges).toHaveBeenCalledWith('gate-02');
    });
  });

  describe('Analysis-Driven Gate Regeneration', () => {
    it('should suggest gate modifications based on coupling hotspots', async () => {
      mockRegenerateGatesFromAnalysis.mockReturnValue({
        originalGates: [
          { id: 'gate-03', name: 'Business Logic', estimatedComplexity: 30 }
        ],
        suggestedGates: [
          { id: 'gate-02b', name: 'Architecture Refactor', estimatedComplexity: 15 },
          { id: 'gate-03', name: 'Business Logic', estimatedComplexity: 25 }
        ],
        changes: [{
          type: 'add',
          gateId: 'gate-02b',
          reason: 'High coupling detected in auth module',
          confidence: 0.85
        }],
        reasoning: 'Detected high coupling in auth.ts with 0.85 confidence'
      });

      const suggestions = regenerateGatesFromAnalysis('gate-02');

      expect(suggestions.changes).toHaveLength(1);
      expect(suggestions.changes[0].type).toBe('add');
      expect(suggestions.changes[0].reason).toContain('High coupling');
      expect(suggestions.changes[0].confidence).toBe(0.85);
    });

    it('should suggest combining gates when complexity is low', async () => {
      mockRegenerateGatesFromAnalysis.mockReturnValue({
        originalGates: [
          { id: 'gate-03', name: 'Feature A', estimatedComplexity: 8 },
          { id: 'gate-04', name: 'Feature B', estimatedComplexity: 7 }
        ],
        suggestedGates: [
          { id: 'gate-03', name: 'Combined Features', estimatedComplexity: 15 }
        ],
        changes: [{
          type: 'modify',
          gateId: 'gate-03',
          reason: 'Multiple low-complexity gates detected - consider combining',
          confidence: 0.6
        }],
        reasoning: 'Average gate complexity 7.5 is below efficiency threshold'
      });

      const suggestions = regenerateGatesFromAnalysis('gate-02');

      expect(suggestions.changes[0].type).toBe('modify');
      expect(suggestions.changes[0].reason).toContain('combining');
      expect(suggestions.changes[0].confidence).toBe(0.6);
    });

    it('should handle no changes needed scenario', async () => {
      mockRegenerateGatesFromAnalysis.mockReturnValue({
        originalGates: [
          { id: 'gate-03', name: 'Well-Structured Feature', estimatedComplexity: 22 }
        ],
        suggestedGates: [
          { id: 'gate-03', name: 'Well-Structured Feature', estimatedComplexity: 22 }
        ],
        changes: [],
        reasoning: 'All metrics within acceptable ranges'
      });

      const suggestions = regenerateGatesFromAnalysis('gate-02');

      expect(suggestions.changes).toHaveLength(0);
      expect(suggestions.reasoning).toContain('acceptable ranges');
    });
  });

  describe('End-to-End Greenfield Workflow', () => {
    it('should simulate complete project lifecycle with analysis', async () => {
      // Gate 1: Core Infrastructure
      mockAnalyzeGateChanges.mockResolvedValueOnce({
        gateId: 'gate-01',
        changedFiles: ['src/core/auth.ts', 'src/core/db.ts', 'src/utils/helpers.ts'],
        incrementalMetrics: {
          coupling: { hotspots: ['auth.ts'] },
          complexity: { average: 4.2 },
          loc: { total: 450 }
        },
        analysisTime: 1500,
        errors: []
      });

      await completeGate('gate-01');

      // Gate 2: API Layer (with regeneration based on Gate 1 analysis)
      mockRegenerateGatesFromAnalysis.mockReturnValue({
        originalGates: [{ id: 'gate-02', name: 'API Layer', estimatedComplexity: 25 }],
        suggestedGates: [{ id: 'gate-02', name: 'API Layer', estimatedComplexity: 28 }],
        changes: [{
          type: 'modify',
          gateId: 'gate-02',
          reason: 'Increased complexity estimate based on auth coupling patterns',
          confidence: 0.75
        }],
        reasoning: 'Adjusted Gate 2 complexity from analysis of Gate 1 coupling'
      });

      mockAnalyzeGateChanges.mockResolvedValueOnce({
        gateId: 'gate-02',
        changedFiles: ['src/api/routes.ts', 'src/api/middleware.ts'],
        incrementalMetrics: {
          coupling: { hotspots: [] },
          complexity: { average: 3.8 },
          loc: { total: 320 }
        },
        analysisTime: 1200,
        errors: []
      });

      await completeGate('gate-02');

      // Verify workflow completed successfully
      expect(mockAnalyzeGateChanges).toHaveBeenCalledTimes(2);
      expect(mockRegenerateGatesFromAnalysis).toHaveBeenCalledTimes(1);
    });
  });
});