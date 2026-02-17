/**
 * Artifact Validation Service Coverage Tests
 *
 * Tests for artifact validation service class
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ArtifactValidationService } from '../../src/analysis/artifact-validation-service.js'
import type { ValidationInput, ValidationResult } from '../../src/analysis/artifact-validation-service.js'

describe('ArtifactValidationService', () => {
  let service: ArtifactValidationService

  beforeEach(() => {
    service = new ArtifactValidationService()
  })

  describe('validate', () => {
    it('should reject validation without artifactPath', async () => {
      const input: ValidationInput = {
        artifactType: 'gate',
      }
      const result = await service.validate(input)
      expect(result.passed).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should return ValidationResult object', async () => {
      const input: ValidationInput = {
        artifactPath: '/non/existent/path',
        artifactType: 'gate',
      }
      const result = await service.validate(input)
      expect(result).toHaveProperty('passed')
      expect(typeof result.passed).toBe('boolean')
    })

    it('should handle missing artifact file', async () => {
      const input: ValidationInput = {
        artifactPath: '/non/existent/file.md',
        artifactType: 'gate',
      }
      const result = await service.validate(input)
      expect(result).toHaveProperty('passed')
      expect(result).toHaveProperty('errors')
    })
  })
})
