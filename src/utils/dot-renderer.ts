/**
 * DOT Renderer Helper
 *
 * Convenience wrapper for rendering Graphviz DOT syntax to SVG.
 * Uses the system graphviz `dot` CLI tool (version 14.0+).
 */

import { GraphvizRenderer } from '../generation/graphviz-renderer.js'

/**
 * Render DOT syntax to SVG using Graphviz.
 * @param dotSyntax Raw DOT/Graphviz syntax
 * @returns SVG as string
 * @throws Error if Graphviz not available or rendering fails
 */
export async function dotToSvg(dotSyntax: string): Promise<string> {
  const renderer = new GraphvizRenderer()
  return renderer.renderToSvg(dotSyntax)
}

/**
 * Check if Graphviz is available on the system.
 * @returns true if `dot` CLI can be invoked
 */
export async function isGraphvizAvailable(): Promise<boolean> {
  const renderer = new GraphvizRenderer()
  return renderer.isAvailable()
}

export { GraphvizRenderer }
