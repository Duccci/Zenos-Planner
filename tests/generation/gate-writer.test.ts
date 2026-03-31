import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { writeGatePRD } from '../../src/generation/gate-writer.js';

const mockWriteFile = vi.fn();

// Mock the file utility used for writing (gate-writer imports writeFile from here)
vi.mock('../../src/utils/file.js', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

vi.mock('../../src/utils/config.js', () => ({
  getZenoGitDir: (root = process.cwd()) => path.join(root, 'zeno'),
}));

describe('Gate Writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('writes gate PRD to file', async () => {
    const content = '# Gate 1: Test';
    const gateNumber = 1;
    const gateName = 'Test Gate';
    const projectRoot = '/project';

    const result = await writeGatePRD(content, gateNumber, gateName, projectRoot);

    const expectedPath = path.join('/project', 'zeno', 'gates', 'gate-01-test-gate.md');
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, content, 'utf-8');
    expect(result).toBe(expectedPath);
  });
});
