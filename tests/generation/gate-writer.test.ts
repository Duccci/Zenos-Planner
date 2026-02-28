import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeGatePRD } from '../../src/generation/gate-writer.js';

const mockWriteFile = vi.fn();

// Mock the file utility used for writing (gate-writer imports writeFile from here)
vi.mock('../../src/utils/file.js', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
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

    const result = await writeGatePRD(content, gateNumber, gateName);

    expect(mockWriteFile).toHaveBeenCalledWith('zeno\\gates\\gate-01-test-gate.md', content, 'utf-8');
    expect(result).toBe('zeno\\gates\\gate-01-test-gate.md');
  });
});