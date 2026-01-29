/**
 * Zeno Hash Utilities
 *
 * Provides SHA-256 hashing for content-addressable storage and references.
 * Short hashes (16 chars) are the Zeno standard for hash references.
 */

import { createHash, type Hash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { HashError } from './errors.js'

/** Standard short hash length for Zeno references */
const SHORT_HASH_LENGTH = 16

/**
 * Generate a full SHA-256 hash (64 hex characters).
 * @param content - String content to hash
 * @returns 64-character hex string
 */
export function fullHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * Generate a short SHA-256 hash (16 hex characters).
 * This is the Zeno standard for hash references.
 * @param content - String content to hash
 * @returns 16-character hex string
 */
export function shortHash(content: string): string {
  return fullHash(content).substring(0, SHORT_HASH_LENGTH)
}

/**
 * Generate a deterministic hash for an object.
 * Keys are sorted to ensure consistent hashing regardless of property order.
 * @param obj - Object to hash
 * @returns 16-character hex string
 */
export function hashObject(obj: unknown): string {
  const content = JSON.stringify(obj, sortedReplacer)
  return shortHash(content)
}

/**
 * JSON replacer that sorts object keys for deterministic output.
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k]
    }
    return sorted
  }
  return value
}

/**
 * Hash a file's contents using streaming for large files.
 * @param filePath - Path to the file to hash
 * @returns Promise resolving to 16-character hex string
 * @throws HashError if file cannot be read
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash: Hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex').substring(0, SHORT_HASH_LENGTH))
    })

    stream.on('error', (error: Error) => {
      reject(new HashError(`Failed to hash file: ${filePath}`, 'HASH_FILE_FAILED', { path: filePath }, error))
    })
  })
}

/**
 * Validate that a string is a valid Zeno hash format.
 * Valid hashes are 16 hexadecimal characters.
 * @param hash - String to validate
 * @returns true if valid hash format
 */
export function isValidHash(hash: string): boolean {
  if (typeof hash !== 'string') return false
  if (hash.length !== SHORT_HASH_LENGTH) return false
  return /^[a-f0-9]+$/i.test(hash)
}

/**
 * Format a hash as a Zeno reference with # prefix.
 * @param hash - Hash to format (with or without #)
 * @returns Hash with # prefix
 */
export function formatHashRef(hash: string): string {
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash
  return `#${cleanHash}`
}

/**
 * Parse a hash reference and extract the hash value.
 * @param ref - Reference string (e.g., "#abc123def456789a")
 * @returns Extracted hash without # prefix, or null if invalid
 */
export function parseHashRef(ref: string): string | null {
  if (typeof ref !== 'string') return null

  const cleanRef = ref.startsWith('#') ? ref.slice(1) : ref

  if (!isValidHash(cleanRef)) return null

  return cleanRef
}

