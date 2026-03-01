declare module 'graphviz' {
  interface Graph {
    render(format: string, callback: (err: Error | null, svg: Buffer | string) => void): void
  }

  export function parse(source: string): Graph
}
