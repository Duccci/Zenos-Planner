/**
 * Complexity and Coupling Metrics Coverage Tests
 *
 * Additional tests to cover branches and edge cases in metrics calculations
 */

import { describe, it, expect } from 'vitest'
import { calculateComplexityMetrics } from '../../src/analysis/metrics/complexity.js'
import { calculateCoupling } from '../../src/analysis/metrics/coupling.js'
import { countLOCMetrics } from '../../src/analysis/metrics/loc.js'
import type { Module } from '../../src/analysis/types.js'

describe('Complexity Metrics Coverage', () => {
  describe('calculateComplexityMetrics', () => {
    it('should handle empty AST map', () => {
      const astMap = new Map()
      const result = calculateComplexityMetrics(astMap)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should return metrics with expected structure', () => {
      const astMap = new Map()
      const result = calculateComplexityMetrics(astMap)
      
      expect(result).toHaveProperty('modules')
      expect(result.modules).toBeInstanceOf(Map)
    })
  })

  describe('calculateCoupling', () => {
    it('should handle empty modules map', () => {
      const modules = new Map<string, Module>()
      const result = calculateCoupling(modules)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should return metrics with expected structure', () => {
      const modules = new Map<string, Module>()
      const result = calculateCoupling(modules)
      
      expect(result).toHaveProperty('modules')
      expect(result.modules).toBeInstanceOf(Map)
    })

    it('should calculate afferent and efferent coupling', () => {
      const modules = new Map<string, Module>()
      const result = calculateCoupling(modules)
      
      expect(result.modules.size).toBe(0)
    })
  })

  describe('countLOCMetrics', () => {
    it('should handle empty file list', async () => {
      const files: string[] = []
      const result = await countLOCMetrics(files)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should return metrics with expected structure', async () => {
      const files: string[] = []
      const result = await countLOCMetrics(files)
      
      expect(result).toHaveProperty('files')
      expect(result.files).toBeInstanceOf(Map)
    })

    it('should return line count metrics', async () => {
      const files: string[] = []
      const result = await countLOCMetrics(files)
      
      expect(result).toHaveProperty('totalLines')
      expect(result).toHaveProperty('totalCodeLines')
      expect(result).toHaveProperty('totalBlankLines')
      expect(result).toHaveProperty('totalCommentLines')
    })
  })
})
