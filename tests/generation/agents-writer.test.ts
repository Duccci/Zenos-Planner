import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeAgentsMD } from '../../src/generation/agents-writer.js';
import { readFile } from 'fs/promises';

const mockWriteFile = vi.fn();

// Mock fs/promises for readFile (agents-writer imports readFile directly from here)
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock the file utility used for writing (agents-writer imports writeFile from here)
vi.mock('../../src/utils/file.js', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

describe('Agents Writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('writes AGENTS.md when file does not exist', async () => {
    (readFile as any).mockRejectedValue(new Error('File not found'));
    const content = '# Test';
    const basePath = '/project';

    const result = await writeAgentsMD(content, basePath);

    expect(mockWriteFile).toHaveBeenCalledWith('\\project\\zeno\\AGENTS.md', content, 'utf-8');
    expect(result).toBe('\\project\\zeno\\AGENTS.md');
  });

  it('merges with existing content', async () => {
    (readFile as any).mockResolvedValue('Existing content');
    const content = 'New content';
    const basePath = '/project';

    const result = await writeAgentsMD(content, basePath);

    expect(mockWriteFile).toHaveBeenCalledWith('\\project\\zeno\\AGENTS.md', 'Existing content\n\n---\n\nNew content', 'utf-8');
  });
});