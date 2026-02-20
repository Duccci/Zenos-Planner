/**
 * Config Registry Tests
 *
 * Covers config_get operation:
 * - success path (returns loaded config)
 * - CONFIG_NOT_FOUND error (returns default config)
 * - other errors (rethrows)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionRegistry } from '../../src/integration/function-registry.js'
import { registerConfigOps } from '../../src/integration/config-registry.js'
import { ConfigError } from '../../src/utils/errors.js'

const mockLoadConfig = vi.fn()
const mockGetDefaultConfig = vi.fn()

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  getDefaultConfig: (...args: unknown[]) => mockGetDefaultConfig(...args),
}))

describe('config-registry operations', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new FunctionRegistry()
    registerConfigOps(registry)
  })

  it('registers config_get', () => {
    expect(registry.get('config_get')).toBeDefined()
  })

  it('returns config on success', async () => {
    const config = {
      version: '1.0.0',
      projectName: 'Test Project',
      quality: { coverageThreshold: 90 },
    }
    mockLoadConfig.mockResolvedValue(config)

    const result = (await registry.invoke('config_get', {})) as { success: boolean; data: unknown }
    expect(result.success).toBe(true)
    expect(result.data).toEqual(config)
  })

  it('returns default config when CONFIG_NOT_FOUND', async () => {
    const notFoundError = new ConfigError('Config not found', 'CONFIG_NOT_FOUND')
    mockLoadConfig.mockRejectedValue(notFoundError)

    const defaultConfig = { version: '1.0.0', projectName: 'Unknown Project' }
    mockGetDefaultConfig.mockReturnValue(defaultConfig)

    const result = (await registry.invoke('config_get', {})) as { success: boolean; data: unknown }
    expect(result.success).toBe(true)
    expect(result.data).toEqual(defaultConfig)
    expect(mockGetDefaultConfig).toHaveBeenCalledWith('Unknown Project', 'No end state defined')
  })

  it('rethrows non-CONFIG_NOT_FOUND ConfigError', async () => {
    const validationError = new ConfigError('Invalid config schema', 'CONFIG_VALIDATION_ERROR')
    mockLoadConfig.mockRejectedValue(validationError)

    const result = (await registry.invoke('config_get', {})) as { success: boolean }
    expect(result.success).toBe(false)
  })

  it('rethrows generic errors', async () => {
    mockLoadConfig.mockRejectedValue(new Error('File system error'))

    const result = (await registry.invoke('config_get', {})) as { success: boolean }
    expect(result.success).toBe(false)
  })
})
