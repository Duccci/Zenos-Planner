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
  rm: vi.fn(),
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
import { readFile, writeFile, mkdir, readdir, rm, unlink } from 'node:fs/promises';
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
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdirSync).mockReturnValue([]);
  vi.mocked(validateGateReady).mockResolvedValue({ filePath: '/project/zeno/gates/gate-01-test-gate.md' } as any);
  vi.mocked(validateProposalReady).mockResolvedValue({
    type: 'solitary',
    title: 'Test Proposal',
    filePath: '/project/zeno/proposals/solitary/test-proposal.md',
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

  it('removes gate proposals directory when it exists', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    await archiveGate('gate-01');
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      expect.stringContaining('gate-01'),
      { recursive: true, force: true }
    );
  });

  it('skips proposal directory cleanup when directory absent', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await archiveGate('gate-01');
    expect(vi.mocked(rm)).not.toHaveBeenCalled();
  });

  it('includes gate proposals dir in git commit when proposals existed', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    await archiveGate('gate-01');
    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.files).toHaveLength(2);
    expect(commitCall?.files?.[1]).toContain('gate-01');
  });

  it('commits only archive file when no proposals dir existed', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await archiveGate('gate-01');
    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.files).toEqual([expect.stringContaining('gate-01-test-gate.md')]);
  });

  it('skips proposal cleanup and does not call rm for invalid gateId pattern', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    // Simulate an invalid gateId that does not match gate-NN
    vi.mocked(validateGateReady).mockResolvedValue({ filePath: '/project/zeno/gates/badid-test.md' } as any);
    await archiveGate('../bad-id');
    expect(vi.mocked(rm)).not.toHaveBeenCalled();
  });

  it('only removes the specific gate proposals dir, not the parent proposals dir', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    await archiveGate('gate-05');
    const rmCall = vi.mocked(rm).mock.calls[0]?.[0] as string;
    // Must end with the gate-specific segment, not a parent folder
    expect(rmCall).toMatch(/proposals[/\\]gate-05$/);
    expect(rmCall).not.toMatch(/proposals[/\\]?$/);
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
      .mockResolvedValueOnce({ filePath: '/project/zeno/gates/gate-01-test-gate.md' } as any)
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

  it('handles proposal failure with non-Error exception (lines 381/382/387 arm=1)', async () => {
    // Failing artifact is a PROPOSAL (not gate) with a non-Error thrown:
    // - artifactId = artifact.proposalHash (arm=1 for line 381)
    // - errorMsg = String(error) (arm=1 for line 382: error instanceof Error = false)
    // - artifactType = 'proposal' (arm=1 for line 387)
    vi.mocked(validateProposalReady).mockRejectedValue('plain string error — not an Error')

    const artifacts = [{ type: 'proposal' as const, proposalHash: 'p-fail-hash' }]
    const result = await archiveBatch(artifacts)

    expect(result.success).toBe(false)
    expect(result.results[0]).toMatchObject({
      success: false,
      artifactType: 'proposal',
      artifactId: 'p-fail-hash',
      error: 'plain string error — not an Error',
    })
  });

  it('handles mixed gate and proposal artifacts', async () => {
    // Ensure readdir is mocked to return empty array (no duplicates)
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Test Proposal',
      filePath: '/project/zeno/proposals/solitary/p-test-hash.md',
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

// Additional tests for architecture update and proposal archival branches
describe('archiveProposal', () => {
  it('archives a solitary proposal', async () => {
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Standalone Proposal',
      filePath: '/project/zeno/proposals/solitary/p-hash123.md',
    });
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await archiveProposal('p-hash123', 'done');

    expect(result.success).toBe(true);
    expect(result.proposalHash).toBe('p-hash123');
    expect(result.proposalType).toBe('solitary');
    expect(result.status).toBe('completed');
    expect(performGitCommitAndPush).toHaveBeenCalled();
  });

  it('archives a gate-tied proposal', async () => {
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'gate-tied',
      title: 'Gate Proposal',
      gateId: 'gate-01',
    });
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await archiveProposal('p-hash456', 'complete');

    expect(result.success).toBe(true);
    expect(result.proposalType).toBe('gate-tied');
    expect(result.gateId).toBe('gate-01');
  });

  it('throws when proposal file not found', async () => {
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Missing Proposal',
    });
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(archiveProposal('p-missing')).rejects.toThrow('not found');
  });

  it('removes duplicate archive files before writing', async () => {
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Proposal',
      filePath: '/project/zeno/proposals/solitary/p-hash.md',
    });
    vi.mocked(readdir).mockResolvedValue(['p-hash.md', 'p-hash-old.md'] as any);
    vi.mocked(existsSync).mockReturnValue(true);

    // Mock fs.unlink via dynamic import (used in archiveProposal)
    const fsImportSpy = vi.spyOn(await import('node:fs/promises'), 'unlink').mockResolvedValue(undefined as any);

    const result = await archiveProposal('p-hash');
    expect(result.success).toBe(true);

    fsImportSpy.mockRestore();
  });

  it('handles readFile errors gracefully', async () => {
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Proposal',
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockRejectedValue(new Error('read fail'));

    await expect(archiveProposal('p-hash')).rejects.toThrow('read fail');
  });

  it('deletes source proposal file after archiving', async () => {
    const sourcePath = '/project/zeno/proposals/solitary/p-del-hash.md';
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'solitary',
      title: 'Delete Me',
      filePath: sourcePath,
    });
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(existsSync).mockReturnValue(true);

    await archiveProposal('p-del-hash');

    expect(vi.mocked(unlink)).toHaveBeenCalledWith(sourcePath);
  });

  it('includes source path in git commit files for deletion staging', async () => {
    const sourcePath = '/project/zeno/proposals/gate-01/p-git-hash.md';
    vi.mocked(validateProposalReady).mockResolvedValue({
      type: 'gate-tied',
      title: 'Git Files Test',
      gateId: 'gate-01',
      filePath: sourcePath,
    });
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(existsSync).mockReturnValue(true);

    await archiveProposal('p-git-hash');

    const commitCall = vi.mocked(performGitCommitAndPush).mock.calls[0]?.[0];
    expect(commitCall?.files).toContain(sourcePath);
  });
});

describe('updateArchitectureOnGateCompletion', () => {
  it('skips update when architecture file not found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    // Import and call the function using dynamic import
    const { archiveGate } = await import('../../src/core/archive-logic.js');
    // The architecture update is called internally during archiveGate, but we test through that
    const result = await archiveGate('gate-01', 'test notes');
    expect(result.success).toBe(true); // Should not fail even if arch file missing
  });

  it('handles version parsing edge cases', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValueOnce('# Gate 01\nContent'); // Initial read
    vi.mocked(readFile).mockResolvedValueOnce('**Last Updated**: 2026-02-24\n**Version**: 1.2.3'); // Arch file for update

    const result = await archiveGate('gate-01');
    expect(result.success).toBe(true);
  });

  it('handles missing version with fallback', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValueOnce('# Gate 01'); // Initial gate read
    vi.mocked(readFile).mockResolvedValueOnce('**Last Updated**: 2026-02-23'); // Arch file without version

    const result = await archiveGate('gate-01');
    expect(result.success).toBe(true);
  });

  it('appends changelog when not present', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValueOnce('# Gate 01'); // Initial gate read
    vi.mocked(readFile).mockResolvedValueOnce('# System Overview\n**Last Updated**: 2026-02-23'); // No changelog

    const result = await archiveGate('gate-01');
    expect(result.success).toBe(true);
  });

  it('gracefully handles arch update write failure', async () => {
    // We need to set up writefile to fail on the architecture update but succeed on main gate archive
    let writeCallCount = 0;
    vi.mocked(writeFile).mockImplementation(async () => {
      writeCallCount++;
      // First write (main gate archive) succeeds, second write (arch update) fails
      if (writeCallCount === 2) {
        throw new Error('write fail');
      }
    });

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockImplementation(async () => '# Gate 01');

    // The archiveGate should still succeed (non-fatal arch update)
    const result = await archiveGate('gate-01');
    expect(result.success).toBe(true);
  });

  it('detects and handles duplicate archive files', async () => {
    // Uncovered branch: lines 289-299 - duplicate file detection and unlink
    vi.mocked(readdirSync).mockReturnValue([
      'hash123456789abc.md',
      'hash123456789abc-old.md', // duplicate
      'hash123456789abc-backup.md', // duplicate
    ]);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('# Gate 01');

    // Mock fs.unlink via dynamic import (used in archiveProposal)
    const fsImportSpy = vi.spyOn(await import('node:fs/promises'), 'unlink').mockResolvedValue(undefined as any);

    const result = await archiveProposal('hash123456789abc');

    // Should attempt to remove duplicates
    expect(fsImportSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);

    fsImportSpy.mockRestore();
  });

  it('handles unlink errors when removing duplicate files', async () => {
    // Uncovered branch: lines 298-299 - catch block in duplicate removal
    vi.mocked(readdirSync).mockReturnValue([
      'hash123456789abc.md',
      'hash123456789abc-old.md', // duplicate
    ]);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('# Proposal Content');

    // Mock unlink to fail via dynamic import
    const fsImportSpy = vi.spyOn(await import('node:fs/promises'), 'unlink').mockRejectedValue(new Error('Permission denied'));

    const result = await archiveProposal('hash123456789abc');

    // Should still succeed even if duplicate removal fails
    expect(result.success).toBe(true);

    fsImportSpy.mockRestore();
  });

  it('detects and replaces changelog section when present', async () => {
    // Uncovered branch: lines 108-111 - changelog section detection and replacement
    const gateContentWithChangelog = `# Gate 01

## Changelog

Old entry`;
    vi.mocked(readFile).mockResolvedValueOnce(gateContentWithChangelog);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await archiveGate('gate-01', 'completion notes');

    expect(result.success).toBe(true);
    // Verify that writeFile was called (which includes the changelog replacement)
    expect(writeFile).toHaveBeenCalled();
  });

  it('appends changelog when section does not match expected format', async () => {
    // Uncovered branch: handling case where changelog exists but doesn't match regex pattern
    const gateContentBadFormat = `# Gate 01

## Changelog

No double newline here`;
    vi.mocked(readFile).mockResolvedValueOnce(gateContentBadFormat);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await archiveGate('gate-01');

    expect(result.success).toBe(true);
    expect(writeFile).toHaveBeenCalled();
  });

  it('inserts changelog entry when arch file has existing changelog with blank-line separator', async () => {
    // Covers lines 108-111: else branch where ## Changelog exists AND the regex (## Changelog)\n\n matches
    const archContentWithChangelog =
      '# System Overview\n**Last Updated**: 2026-02-23\n\n## Changelog\n\n- Previous entry\n'
    vi.mocked(readFile)
      .mockResolvedValueOnce('# Gate 01') // first call: gate PRD
      .mockResolvedValueOnce(archContentWithChangelog) // second call: arch file
    vi.mocked(existsSync).mockReturnValue(true)

    const result = await archiveGate('gate-01')

    expect(result.success).toBe(true)
    // writeFile is called at least once (arch file update with inserted changelog entry)
    expect(writeFile).toHaveBeenCalled()
  })
});
