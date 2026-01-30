import { describe, it, expect, vi } from 'vitest';
import { writeAgentsMD } from '../../src/generation/agents-writer.js';
import { readFile, writeFile } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('Agents Writer', () => {
  it('writes AGENTS.md when file does not exist', async () => {
    (readFile as any).mockRejectedValue(new Error('File not found'));
    const content = '# Test';
    const basePath = '/project';

    const result = await writeAgentsMD(content, basePath);

    expect(writeFile).toHaveBeenCalledWith('\\project\\zeno\\AGENTS.md', content, 'utf-8');
    expect(result).toBe('\\project\\zeno\\AGENTS.md');
  });

  it('merges with existing content', async () => {
    (readFile as any).mockResolvedValue('Existing content');
    const content = 'New content';
    const basePath = '/project';

    const result = await writeAgentsMD(content, basePath);

    expect(writeFile).toHaveBeenCalledWith('\\project\\zeno\\AGENTS.md', 'Existing content\n\n---\n\nNew content', 'utf-8');
  });
});