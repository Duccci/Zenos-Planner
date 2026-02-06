import { watch } from 'node:fs'
import { join } from 'node:path'

export interface DevModeOptions {
  watchPattern?: string
  debounceMs?: number
  onRestart: (filename: string) => Promise<void> | void
}

export function enableDevMode(options: DevModeOptions) {
  const watchPattern = options.watchPattern || 'src/**/*.ts'
  const debounceMs = options.debounceMs ?? 500

  const watchDir = watchPattern.split('/')[0] || 'src'

  let restartTimeout: NodeJS.Timeout | null = null

  const watcher = watch(join(process.cwd(), watchDir), { recursive: true }, (_eventType, filename) => {
    if (!filename || !filename.endsWith('.ts')) return

    if (restartTimeout) clearTimeout(restartTimeout)

    restartTimeout = setTimeout(async () => {
      restartTimeout = null
      try {
        await Promise.resolve(options.onRestart(filename))
      } catch {
        // swallow errors - restart will be attempted again on next change
      }
    }, debounceMs)
  })

  return {
    close: () => {
      try {
        watcher.close()
      } catch {
        // ignore
      }
    }
  }
}
