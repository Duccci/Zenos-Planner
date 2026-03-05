/**
 * Graphviz Diagram Renderer
 *
 * Handles rendering of Graphviz DOT syntax by invoking the `dot` CLI tool
 * to produce SVG output, with fallback and error handling.
 */

import { execFile, spawn } from 'node:child_process'

/**
 * Platform-specific installation instructions for Graphviz
 */
function getInstallInstructions(): string {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return `brew install graphviz`
    case 'linux':
      return `sudo apt-get install graphviz  # Debian/Ubuntu\nsudo yum install graphviz  # Red Hat/CentOS`
    case 'win32':
      return `choco install graphviz  # Using Chocolatey\nwinget install graphviz  # Using Windows Package Manager`
    default:
      return `Visit https://graphviz.org/download/ for installation instructions for ${platform}`
  }
}

/**
 * Renderer for Graphviz DOT diagrams
 */
export class GraphvizRenderer {
  /**
   * Check if Graphviz `dot` CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      execFile('dot', ['-V'], {}, (error: unknown) => {
        resolve(!error)
      })
    })
  }

  /**
   * Build a markdown `<img>` reference pointing to a pre-rendered SVG file.
   * Suitable for embedding rendered Graphviz output in markdown documents.
   *
   * @param relativePath - Relative path to the SVG file (e.g. 'dot-diagrams/system-overview.svg')
   * @param alt - Alt text for the image. Defaults to "Architecture Diagram".
   */
  buildMarkdownImgRef(relativePath: string, alt = 'Architecture Diagram'): string {
    return `<img src="${relativePath}" alt="${alt}" />`
  }

  /**
   * Render DOT syntax to SVG by invoking `dot -Tsvg`
   * @throws Error if `dot` CLI is not available or rendering fails
   */
  async renderToSvg(dotSyntax: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const proc = spawn('dot', ['-Tsvg'], {
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        // Collect output - stdout and stderr always exist with stdio: ['pipe', 'pipe', 'pipe']
        proc.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8')
        })

        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8')
        })

        // Handle process completion
        proc.on('close', (code: number | null) => {
          if (code === 0) {
            resolve(stdout)
          } else {
            const instructions = getInstallInstructions()
            if (stderr.includes('not found') || stderr.includes('ENOENT')) {
              reject(
                new Error(
                  `Graphviz 'dot' CLI not found. Please install Graphviz:\n${instructions}\n\nOr run: zeno arch setup-graphviz`
                )
              )
            } else {
              reject(
                new Error(
                  `Failed to render Graphviz diagram: ${stderr || `exit code ${String(code)}`}`
                )
              )
            }
          }
        })

        proc.on('error', (error: Error) => {
          const err = error.message
          if (err.includes('ENOENT') || err.includes('not found')) {
            const instructions = getInstallInstructions()
            reject(
              new Error(
                `Graphviz 'dot' CLI not found. Please install Graphviz:\n${instructions}\n\nOr run: zeno arch setup-graphviz`
              )
            )
          } else {
            reject(new Error(`Failed to render Graphviz diagram: ${err}`))
          }
        })

        // Send input to process - stdin always exists with stdio: ['pipe', 'pipe', 'pipe']
        proc.stdin.write(dotSyntax)
        proc.stdin.end()
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error)
        reject(new Error(`Failed to spawn dot process: ${err}`))
      }
    })
  }

  /**
   * Embed SVG in markdown, optionally wrapped in a collapse block if it exceeds size threshold
   * @param svg SVG content (string)
   * @param summary HTML summary text for the collapse block
   * @param collapseThresholdBytes Size in bytes; if SVG exceeds this, wrap in <details>
   * @returns Markdown with embedded or collapsed SVG
   */
  embedInMarkdown(svg: string, summary: string, collapseThresholdBytes = 50000): string {
    const svgBytes = Buffer.byteLength(svg, 'utf8')

    if (svgBytes > collapseThresholdBytes) {
      // Wrap in collapsible block for large SVGs
      return ['<details>', `<summary>${summary}</summary>`, '', svg, '', '</details>'].join('\n')
    }

    // Embed directly for small SVGs
    return svg
  }
}

export default GraphvizRenderer
