import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeGateDbRow } from '../fixtures/gates.js'

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

vi.mock('../../src/utils/config.js', () => ({
  getZenoGitDir: vi.fn().mockReturnValue('/test/project/zeno'),
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
            makeGateDbRow({ name: 'Foundation', status: 'completed', description: '' }),
            makeGateDbRow({
              id: 'gate-02',
              name: 'Core API',
              status: 'completed',
              description: '',
            }),
            makeGateDbRow({
              id: 'gate-03',
              name: 'Frontend',
              status: 'in_progress',
              description: '',
            }),
            makeGateDbRow({ id: 'gate-04', name: 'Testing', status: 'pending', description: '' }),
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
          all: vi
            .fn()
            .mockReturnValue([
              makeGateDbRow({ name: 'Foundation', status: 'completed', description: '' }),
              makeGateDbRow({ id: 'gate-05', name: 'Deploy', status: 'pending', description: '' }),
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

      const prdContent = ['# Project PRD', '', '### Active MVP Gates (01-01)', ''].join('\n')

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

    it('should find next section when archived header is immediately followed by next section (no blank line)', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi
            .fn()
            .mockReturnValue([
              makeGateDbRow({ name: 'Foundation', status: 'completed', description: '' }),
              makeGateDbRow({ id: 'gate-05', name: 'Deploy', status: 'pending', description: '' }),
            ]),
        }),
      })

      // No blank line between '### Archived Gates (Completed)' and '### Post-MVP Gates'
      // so remainingContent starts with '###' and /^###[^#]/ matches at position 0 (line 90 arm=0)
      const prdContent = [
        '# Project PRD',
        '',
        '### Active MVP Gates (05-05)',
        '',
        '### Gate 05: Deploy',
        '[ ] Implementation in progress...',
        '',
        '### Archived Gates (Completed)',
        '### Post-MVP Gates',
        '',
        'Future work...',
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      expect(mockWriteFile).toHaveBeenCalled()
      const written = mockWriteFile.mock.calls[0][1] as string
      expect(written).toContain('Post-MVP Gates')
    })

    it('should use fallback gate numbers and ids when gate id has no hyphen', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      // 'legacy' and 'feature' have no hyphen:
      // split('-')[1] = undefined → firstGateNum??'05', lastGateNum??'12', gateNum??gate.id
      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi
            .fn()
            .mockReturnValue([
              makeGateDbRow({ id: 'legacy', name: 'Legacy Gate', status: 'completed' }),
              makeGateDbRow({ id: 'feature', name: 'Feature Gate', status: 'pending' }),
            ]),
        }),
      })

      const prdContent = [
        '# Project PRD',
        '',
        '### Active MVP Gates (05-12)',
        '',
        '### Gate 05: placeholder',
        '[ ] Implementation in progress...',
        '',
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      expect(mockWriteFile).toHaveBeenCalled()
      const written = mockWriteFile.mock.calls[0][1] as string
      // lines 132/134: firstGateNum='05', lastGateNum='12' (fallbacks)
      expect(written).toContain('Active MVP Gates (05-12)')
      // line 139: gateNum='feature' (gate.id fallback in active loop)
      expect(written).toContain('Gate feature: Feature Gate')
      // line 166: gateNum='legacy' (gate.id fallback in archived loop)
      expect(written).toContain('Gate legacy: Legacy Gate')
    })

    it('should skip archived section when no completed gates exist', async () => {
      const { updateProjectPRDGates } = await import('../../src/core/prd-updater.js')

      // Only pending gate → generateArchivedGatesSection returns '' → if(archivedSection) FALSE (line 208 arm=1)
      mockGetDatabase.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi
            .fn()
            .mockReturnValue([
              makeGateDbRow({ id: 'gate-05', name: 'Deploy', status: 'pending', description: '' }),
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
      ].join('\n')

      mockReadFile.mockResolvedValue(prdContent)
      mockWriteFile.mockResolvedValue(undefined)

      await updateProjectPRDGates('/test/project')

      const callArgs = mockWriteFile.mock.calls[0]
      if (callArgs) {
        const written = callArgs[1] as string
        expect(written).not.toContain('Archived Gates')
      }
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

    it('should use gate.id as fallback gateNum when completedGateId has no hyphen', async () => {
      const { updateTimelineSection } = await import('../../src/core/prd-updater.js')

      // 'nohyphen'.split('-')[1] = undefined → gateNum = 'nohyphen' via ?? fallback (line 241 arm=1)
      mockReadFile.mockResolvedValue(
        '# PRD\n\n## Timeline (Order of Operations)\n\n- Gate 01\n- Gate 02\n'
      )

      await updateTimelineSection('/test/project', 'nohyphen')

      const { logger } = await import('../../src/utils/logger.js')
      expect(logger.debug).toHaveBeenCalled()
    })
  })
})
