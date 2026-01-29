import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, logSection, logTable, logHash } from '../../src/utils/logger.js'

describe('logger', () => {
  const originalEnv = process.env['ZENO_LOG_LEVEL']

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalEnv !== undefined) {
      process.env['ZENO_LOG_LEVEL'] = originalEnv
    } else {
      delete process.env['ZENO_LOG_LEVEL']
    }
  })

  describe('log level filtering', () => {
    it('shows info, warn, error at default level', () => {
      delete process.env['ZENO_LOG_LEVEL']

      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      // Debug should not be called (below info level)
      expect(console.log).toHaveBeenCalledTimes(1) // Only info
      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('shows all levels when ZENO_LOG_LEVEL=debug', () => {
      process.env['ZENO_LOG_LEVEL'] = 'debug'

      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      expect(console.log).toHaveBeenCalledTimes(2) // debug + info
      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('only shows error when ZENO_LOG_LEVEL=error', () => {
      process.env['ZENO_LOG_LEVEL'] = 'error'

      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      expect(console.log).not.toHaveBeenCalled()
      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('shows warn and error when ZENO_LOG_LEVEL=warn', () => {
      process.env['ZENO_LOG_LEVEL'] = 'warn'

      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      expect(console.log).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('debug', () => {
    it('includes timestamp in debug output', () => {
      process.env['ZENO_LOG_LEVEL'] = 'debug'

      logger.debug('test message')

      expect(console.log).toHaveBeenCalled()
      const callArgs = vi.mocked(console.log).mock.calls[0]
      expect(callArgs?.[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('info', () => {
    it('logs info message', () => {
      delete process.env['ZENO_LOG_LEVEL']

      logger.info('info message')

      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('logs warning message', () => {
      delete process.env['ZENO_LOG_LEVEL']

      logger.warn('warning message')

      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('logs error message', () => {
      delete process.env['ZENO_LOG_LEVEL']

      logger.error('error message')

      expect(console.error).toHaveBeenCalled()
    })
  })
})

describe('logSection', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env['ZENO_LOG_LEVEL']
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs section with title', () => {
    logSection('Test Section')

    expect(console.log).toHaveBeenCalledTimes(3) // line, title, line
  })

  it('respects log level', () => {
    process.env['ZENO_LOG_LEVEL'] = 'error'

    logSection('Test Section')

    expect(console.log).not.toHaveBeenCalled()
  })

  it('respects warn log level (hides section)', () => {
    process.env['ZENO_LOG_LEVEL'] = 'warn'

    logSection('Test Section')

    expect(console.log).not.toHaveBeenCalled()
  })
})

describe('logTable', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env['ZENO_LOG_LEVEL']
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs table with headers and rows', () => {
    logTable(['Name', 'Value'], [
      ['foo', 'bar'],
      ['baz', 'qux'],
    ])

    expect(console.log).toHaveBeenCalledTimes(4) // header, separator, 2 rows
  })

  it('handles empty rows', () => {
    logTable(['Header'], [])

    expect(console.log).toHaveBeenCalledTimes(2) // header + separator
  })

  it('respects indent option', () => {
    logTable(['H'], [['v']], { indent: 4 })

    const calls = vi.mocked(console.log).mock.calls
    expect(calls[0]?.[0]).toMatch(/^\s{4}/)
  })

  it('respects log level (hides table at error level)', () => {
    process.env['ZENO_LOG_LEVEL'] = 'error'

    logTable(['Header'], [['value']])

    expect(console.log).not.toHaveBeenCalled()
  })

  it('handles rows with missing cells', () => {
    logTable(['A', 'B', 'C'], [
      ['1', '2'],  // Missing third cell
      ['x', 'y', 'z'],
    ])

    expect(console.log).toHaveBeenCalledTimes(4) // header, separator, 2 rows
  })

  it('handles undefined cells in rows', () => {
    const rows: string[][] = [['val', undefined as unknown as string]]
    logTable(['H1', 'H2'], rows)

    expect(console.log).toHaveBeenCalledTimes(3)
  })

  it('uses default indent of 0 when not specified', () => {
    logTable(['H'], [['v']])

    const calls = vi.mocked(console.log).mock.calls
    // First char should not be a space
    expect(calls[0]?.[0]).not.toMatch(/^\s/)
  })
})

describe('logHash', () => {
  it('returns styled hash with # prefix', () => {
    const result = logHash('abc123')
    expect(result).toContain('#abc123')
  })

  it('does not double prefix if already has #', () => {
    const result = logHash('#abc123')
    expect(result).not.toContain('##')
  })
})

