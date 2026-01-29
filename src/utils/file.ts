/**
 * Zeno File System Utilities
 *
 * Provides file operations with atomic writes, JSON handling with Zod validation,
 * and cross-platform path utilities.
 */

import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  rename,
  mkdir,
  stat,
  unlink,
} from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve, relative, normalize, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { FileSystemError, wrapError } from './errors.js'

/**
 * Read a text file and return its contents.
 * @param filePath - Path to the file to read
 * @param encoding - Text encoding (default: utf-8)
 * @returns File contents as string
 * @throws FileSystemError if file cannot be read
 */
export async function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
  try {
    return await fsReadFile(filePath, { encoding })
  } catch (error) {
    throw wrapError(error, `Failed to read file: ${filePath}`, 'FS_READ_FAILED', { path: filePath })
  }
}

/**
 * Read and parse a JSON file with optional Zod schema validation.
 * @param filePath - Path to the JSON file
 * @param schema - Optional Zod schema for validation
 * @returns Parsed and validated JSON data
 * @throws FileSystemError if file cannot be read or parsed
 */
export async function readJsonFile<T>(filePath: string, schema?: z.ZodType<T>): Promise<T> {
  const content = await readFile(filePath)

  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch (error) {
    throw wrapError(error, `Failed to parse JSON: ${filePath}`, 'FS_JSON_PARSE_FAILED', { path: filePath })
  }

  if (schema) {
    const result = schema.safeParse(parsed)
    if (!result.success) {
      throw new FileSystemError(
        `JSON validation failed: ${filePath}`,
        'FS_JSON_VALIDATION_FAILED',
        { path: filePath, errors: result.error.issues }
      )
    }
    return result.data
  }

  return parsed as T
}

/**
 * Check if a file exists.
 * @param filePath - Path to check
 * @returns true if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile()
  } catch {
    return false
  }
}

/**
 * Check if a directory exists.
 * @param dirPath - Path to check
 * @returns true if directory exists, false otherwise
 */
export function directoryExists(dirPath: string): boolean {
  try {
    return existsSync(dirPath) && statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

/**
 * Write content to a file using atomic write pattern.
 * Writes to a temp file first, then renames to target (atomic on same filesystem).
 * @param filePath - Target file path
 * @param content - Content to write
 * @param encoding - Text encoding (default: utf-8)
 * @throws FileSystemError if write fails
 */
export async function writeFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<void> {
  const tempPath = `${filePath}.tmp.${randomBytes(8).toString('hex')}`

  try {
    // Ensure parent directory exists
    await ensureDir(dirname(filePath))

    // Write to temp file
    await fsWriteFile(tempPath, content, { encoding })

    // Atomic rename
    await rename(tempPath, filePath)
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (existsSync(tempPath)) {
        await unlink(tempPath)
      }
    } catch {
      // Ignore cleanup errors
    }

    throw wrapError(error, `Failed to write file: ${filePath}`, 'FS_WRITE_FAILED', { path: filePath })
  }
}

/**
 * Write an object to a JSON file with consistent formatting.
 * @param filePath - Target file path
 * @param data - Object to serialize
 * @throws FileSystemError if write fails
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n'
  await writeFile(filePath, content)
}

/**
 * Ensure a directory exists, creating it and parents if necessary.
 * @param dirPath - Directory path to ensure
 * @throws FileSystemError if directory cannot be created
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    throw wrapError(error, `Failed to create directory: ${dirPath}`, 'FS_MKDIR_FAILED', { path: dirPath })
  }
}

/**
 * Get the path relative to a base directory.
 * @param absolutePath - Absolute path to convert
 * @param basePath - Base directory (default: process.cwd())
 * @returns Relative path
 */
export function getRelativePath(absolutePath: string, basePath: string = process.cwd()): string {
  return normalizePath(relative(basePath, absolutePath))
}

/**
 * Resolve a path to absolute, handling both relative and absolute inputs.
 * @param inputPath - Path to resolve
 * @param basePath - Base directory for relative paths (default: process.cwd())
 * @returns Absolute path
 */
export function resolvePath(inputPath: string, basePath: string = process.cwd()): string {
  return resolve(basePath, inputPath)
}

/**
 * Normalize a path for cross-platform consistency.
 * Converts backslashes to forward slashes.
 * @param inputPath - Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(inputPath: string): string {
  const normalized = normalize(inputPath)
  return sep === '\\' ? normalized.replace(/\\/g, '/') : normalized
}

/**
 * Get file stats safely, returning null if file doesn't exist.
 * @param filePath - Path to check
 * @returns File stats or null
 */
export async function getFileStats(filePath: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(filePath)
  } catch {
    return null
  }
}

