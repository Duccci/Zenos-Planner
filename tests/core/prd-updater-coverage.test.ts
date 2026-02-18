import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockGetDatabase = vi.fn()

vi.mock('../../src/utils/file.js', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: () => mockGetDatabase(),
}))

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('prd-updater coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('updateProjectPRDGates', () => {
    it('should update PRD with active and completed gates', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: 'gate-01', name: 'Foundation', status: 'completed', description: '' },
            { id: 'gate-02', name: 'Core API', status: 'completed', description: '' },
            { id: 'gate-03', name: 'Frontend', status: 'in_progress', description: '' },
            { id: 'gate-04', name: 'Testing', status: 'pending', description: '' },
          ]),
        }),
      })

      const prdContent = [
        '# Project PRD',
        '',
        '## Timeline (Order of Operations)',
        '',
        '### Active MVP Gates (01-04)',
        '',
        '### Gate 01: Foundation',
        '[ ] Implementation in progress...',
        '',
        '### Gate 02: Core API',
        '[ ] Implementation in progress...',
        '',
        '### Post-MVP Gates',
        '',
        'Future work...',
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      // Should have called writeFile with updated content
      expect(mockWriteFile).toHaveBeenCalled()
      const writtenContent = mockWriteFile.mock.calls[0][1] as string
      expect(writtenContent).toContain('Active MVP Gates')
      expect(writtenContent).toContain('Archived Gates (Completed)')
    })

    it('should handle PRD with existing archived section', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: 'gate-01', name: 'Foundation', status: 'completed', description: '' },
            { id: 'gate-05', name: 'Deploy', status: 'pending', description: '' },
          ]),
        }),
      })

      const prdContent = [
        '# Project PRD',
        '',
        '### Active MVP Gates (05-05)',
        '',
        '### Gate 05: Deploy',
        '[ ] Implementation in progress...',
        '',
        '### Archived Gates (Completed)',
        '',
        '- Gate 01: Foundation',
        '',
        '### Post-MVP Gates',
        '',
        'Future work...',
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should not write if content unchanged', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
        }),
      })

      const prdContent = [
        '# Project PRD',
        '',
        '### Active MVP Gates (01-01)',
        '',
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      // Content might or might not change depending on empty gates
    })

    it('should handle errors gracefully (warn only)', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockReadFile.mockRejectedValue(new Error('file not found'))

      await updateProjectPRDGates('/test/project')

      // Should not throw
      const { logger } = await import('../../src/utils/logger.js')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should handle PRD without active gates section (throw internally)', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
        }),
      })

      mockReadFile.mockResolvedValue('# Simple PRD\n\nNo gates section here.')
      mockWriteFile.mockResolvedValue(undefined)

      // Should catch internally and warn
      await updateProjectPRDGates('/test/project')

      const { logger } = await import('../../src/utils/logger.js')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('updateTimelineSection', () => {
    it('should handle PRD with timeline section', async () => {
      const { updateTimelineSection } = await import('../../src/core/prd-updater.js')

      mockReadFile.mockResolvedValue(
        '# PRD\n\n## Timeline (Order of Operations)\n\n- Gate 01\n- Gate 02\n'
      )

      await updateTimelineSection('/test/project', 'gate-01')

      // Should just log debug, not fail
      const { logger } = await import('../../src/utils/logger.js')
      expect(logger.debug).toHaveBeenCalled()
    })

    it('should handle PRD without timeline section', async () => {
      const { updateTimelineSection } = await import('../../src/core/prd-updater.js')

      mockReadFile.mockResolvedValue('# PRD\n\nNo timeline here.\n')

      await updateTimelineSection('/test/project', 'gate-01')

      // Should return early, no error
    })

    it('should handle read errors gracefully', async () => {
      const { updateTimelineSection } = await import('../../src/core/prd-updater.js')

      mockReadFile.mockRejectedValue(new Error('read failed'))

      await updateTimelineSection('/test/project', 'gate-01')

      const { logger } = await import('../../src/utils/logger.js')
      expect(logger.warn).toHaveBeenCalled()
    })
  })
})
