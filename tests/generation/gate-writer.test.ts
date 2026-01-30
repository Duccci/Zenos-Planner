import { describe, it, expect, vi } from 'vitest';
import { writeGatePRD } from '../../src/generation/gate-writer.js';
import { writeFile } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

describe('Gate Writer', () => {
  it('writes gate PRD to file', async () => {
    const content = '# Gate 1: Test';
    const gateNumber = 1;
    const gateName = 'Test Gate';

    const result = await writeGatePRD(content, gateNumber, gateName);

    expect(writeFile).toHaveBeenCalledWith('zeno\\gates\\gate-01-test-gate.md', content, 'utf-8');
    expect(result).toBe('zeno\\gates\\gate-01-test-gate.md');
  });
});