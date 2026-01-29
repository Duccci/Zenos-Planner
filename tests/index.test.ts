import { describe, it, expect } from 'vitest'
import { VERSION } from '../src/index.js'

describe('index', () => {
  it('exports VERSION constant', () => {
    expect(VERSION).toBe('0.1.0')
  })
})

