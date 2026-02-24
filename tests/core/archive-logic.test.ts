/**
 * Tests for archive-logic orchestrator (archiveGate, archiveBatch)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn(),
  getZenoDir: vi.fn(),
  findProjectRoot: vi.fn(),
}));

vi.mock('../../src/utils/gate-consolidation.js', () => ({
  consolidateGateProposals: vi.fn(),
}));

vi.mock('../../src/core/archive-validation.js', () => ({
  validateGateReady: vi.fn(),
  validateProposalReady: vi.fn(),
}));

vi.mock('../../src/core/archive-consolidation.js', () => ({
  prepareArchiveContent: vi.fn(),
}));

vi.mock('../../src/core/archive-execution.js', () => ({
  getCurrentTimestamp: vi.fn(),
  calculateNextGateId: vi.fn(),
  createTagName: vi.fn(),
  performGitCommitAndPush: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/core/metrics-capture.js', () => ({
  captureMetricsSnapshot: vi.fn(),
}));

import { archiveGate, archiveBatch, archiveProposal } from '../../src/core/archive-logic.js';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { loadConfig, getZenoDir } from '../../src/utils/config.js';
import { consolidateGateProposals } from '../../src/utils/gate-consolidation.js';
import { validateGateReady, validateProposalReady } from '../../src/core/archive-validation.js';
import { prepareArchiveContent } from '../../src/core/archive-consolidation.js';
import {
  getCurrentTimestamp,
  calculateNextGateId,
  createTagName,
  performGitCommitAndPush,
} from '../../src/core/archive-execution.js';

const mockConsolidation = {
  requirementsFulfilled: [{ hash: '#req1', proposalHash: 'p1' }],
  lessonsLearned: ['lesson1'],
  nextDependencies: [{ hash: '#dep1', description: 'next', proposalHash: 'p1' }],
  highLevelDelta: {
    summary: 'done',
    artifactsCreated: [],
    qualityMetrics: { totalCoverage: '90%', totalFiles: 5, totalTasks: 3 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getZenoDir).mockReturnValue('/project/zeno/.zeno');
  vi.mocked(loadConfig).mockResolvedValue({ git: { remote: 'origin' } } as any);
  vi.mocked(getCurrentTimestamp).mockReturnValue('2026-02-16T00:00:00Z');
  vi.mocked(calculateNextGateId).mockReturnValue('gate-02');
  vi.mocked(createTagName).mockReturnValue('archive/gate-01/test-gate');
  vi.mocked(consolidateGateProposals).mockResolvedValue(mockConsolidation);
  vi.mocked(prepareArchiveContent).mockReturnValue('# Archived content');
  vi.mocked(readFile).mockResolvedValue('# Gate 01 Test Gate\n**Status**: completed');
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(readdir).mockResolvedValue([]);
  vi.mocked(unlink).mockResolvedValue(undefined);
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdirSync).mockReturnValue([]);
  vi.mocked(validateGateReady).mockResolvedValue(undefined);
  vi.mocked(validateProposalReady).mockResolvedValue({
    type: 'solitary',
    title: 'Test Proposal',
  } as any);
  vi.mocked(performGitCommitAndPush).mockResolvedValue(undefined);
});

describe('archiveGate', () => {
  it('orchestrates full archive workflow', async () => {
    const result = await archiveGate('gate-01', 'completion notes');

    expect(validateGateReady).toHaveBeenCalledWith('gate-01');
    expect(mkdir).toHaveBeenCalled();
    expect(readFile).toHaveBeenCalled();
    expect(consolidateGateProposals).toHaveBeenCalled();
    expect(prepareArchiveContent).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(performGitCommitAndPush).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.gateId).toBe('gate-01');
    expect(result.gateName).toBe('Gate 01 Test Gate');
    expect(result.nextGateId).toBe('gate-02');
    expect(result.consolidatedProposals).toBe(1);
    expect(result.fulfilledRequirements).toBe(1);
    expect(result.gitTag).toBe('archive/gate-01/test-gate');
  });

  it('extracts gate name from markdown heading', async () => {
    vi.mocked(readFile).mockResolvedValue('# My Custom Gate\nContent here');
    const result = await archiveGate('gate-01');
    expect(result.gateName).toBe('My Custom Gate');
  });

  it('falls back to gateId when no heading found', async () => {
    vi.mocked(readFile).mockResolvedValue('No heading here');
    const result = await archiveGate('gate-01');
    expect(result.gateName).toBe('gate-01');
  });

  it('propagates validation errors', async () => {
    vi.mocked(validateGateReady).mockRejectedValue(new Error('not ready'));
    await expect(archiveGate('gate-01')).rejects.toThrow('not ready');
  });

  it('propagates file read errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    await expect(archiveGate('gate-01')).rejects.toThrow('ENOENT');
  });

  it('propagates git operation errors', async () => {
    vi.mocked(performGitCommitAndPush).mockRejectedValue(new Error('git failed'));
    await expect(archiveGate('gate-01')).rejects.toThrow('git failed');
  });

  it('includes completion notes in commit message', async () => {
    await archiveGate('gate-01', 'my notes');
    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.commitMessage).toContain('Notes: my notes');
  });

  it('omits notes line when no completion notes', async () => {
    await archiveGate('gate-01');
    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.commitMessage).not.toContain('Notes:');
  });
});

describe('archiveBatch', () => {
  it('archives multiple gates and reports success count', async () => {
    const artifacts = [
      { type: 'gate' as const, gateId: 'gate-01' },
      { type: 'gate' as const, gateId: 'gate-02' },
    ];

    const result = await archiveBatch(artifacts);

    expect(result.success).toBe(true);
    expect(result.archivedCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.summary).toContain('2/2');
    expect(result.results[0]).toHaveProperty('artifactType', 'gate');
    expect(result.results[0]).toHaveProperty('success', true);
    expect(result.results[0]).toHaveProperty('output');
  });

  it('continues on error and reports partial success', async () => {
    vi.mocked(validateGateReady)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('gate-02 not ready'));

    const artifacts = [
      { type: 'gate' as const, gateId: 'gate-01' },
      { type: 'gate' as const, gateId: 'gate-02' },
    ];

    const result = await archiveBatch(artifacts);

    expect(result.success).toBe(true);
    expect(result.archivedCount).toBe(1);
    expect(result.results).toHaveLength(2);
    expect(result.summary).toContain('1/2');
    expect(result.results[0]).toHaveProperty('success', true);
    expect(result.results[1]).toHaveProperty('success', false);
    expect(result.results[1]).toHaveProperty('error');
  });

  it('returns success=false when all artifacts fail', async () => {
    vi.mocked(validateGateReady).mockRejectedValue(new Error('fail'));

    const artifacts = [
      { type: 'gate' as const, gateId: 'gate-01' },
      { type: 'gate' as const, gateId: 'gate-02' },
    ];

    const result = await archiveBatch(artifacts);

    expect(result.success).toBe(false);
    expect(result.archivedCount).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toHaveProperty('success', false);
    expect(result.results[1]).toHaveProperty('success', false);
  });

  it('handles empty artifacts array', async () => {
    const result = await archiveBatch([]);

    expect(result.success).toBe(false);
    expect(result.archivedCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('passes completion notes to each archiveGate call', async () => {
    const artifacts = [{ type: 'gate' as const, gateId: 'gate-01' }];

    await archiveBatch(artifacts, 'batch notes');

    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.commitMessage).toContain('Notes: batch notes');
  });

  it('handles mixed gate and proposal artifacts', async () => {
    // Ensure readdir is mocked to return empty array (no duplicates)
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Test Proposal',
    });

    const artifacts = [
      { type: 'gate' as const, gateId: 'gate-01' },
      { type: 'proposal' as const, proposalHash: 'p-test-hash' },
    ];

    const result = await archiveBatch(artifacts);

    expect(result.success).toBe(true);
    expect(result.archivedCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toHaveProperty('artifactType', 'gate');
    expect(result.results[1]).toHaveProperty('artifactType', 'proposal');
  });
});
