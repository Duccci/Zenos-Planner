/**
 * Dependency extractor using Babel AST traversal
 * Identifies imports, exports, and re-exports from parsed code
 */

import type { NodePath } from '@babel/traverse'
import type {
  ImportDeclaration,
  CallExpression,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  VariableDeclarator,
} from '@babel/types'

// Babel traverse typing is complex, use lazy loading
type TraverseFn = (ast: object, visitors: Record<string, unknown>) => void
let traverse: TraverseFn | null = null

function getTraverse(): TraverseFn {
  if (!traverse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const traverseModule = require('@babel/traverse') as { default?: TraverseFn } | TraverseFn
    traverse =
      typeof traverseModule === 'function'
        ? traverseModule
        : (traverseModule as { default: TraverseFn }).default
  }
  return traverse
}

import type { File as BabelFile } from '@babel/types'
import path from 'path'
import type { Dependencies, DependencyInfo } from './types.js'

/**
 * Extract all import/export dependencies from a parsed AST
 * @param ast - Babel AST from parsed file
 * @param _filePath - File path (for context)
 * @returns Dependencies object with imports, exports, reexports
 */
export function extractDependencies(
  ast: BabelFile | null | undefined,
  _filePath: string
): Dependencies {
  const imports: DependencyInfo[] = []
  const exports: string[] = []
  const reexports: DependencyInfo[] = []
  const seenImports = new Set<string>()

  // Guard against null/undefined AST
  if (!ast) {
    return { imports, exports, reexports }
  }

  getTraverse()(ast, {
    ImportDeclaration(nodePath: NodePath<ImportDeclaration>) {
      const source = nodePath.node.source.value
      const names: string[] = []
      for (const spec of nodePath.node.specifiers) {
        switch (spec.type) {
          case 'ImportSpecifier': {
            const imp = spec.imported
            names.push(imp.type === 'Identifier' ? imp.name : imp.value)
            break
          }
          case 'ImportDefaultSpecifier':
            names.push(spec.local.name)
            break
          case 'ImportNamespaceSpecifier':
            names.push('*')
            break
          default:
            names.push('unknown')
        }
      }

      const importKey = `${source}:${names.join(',')}`
      if (!seenImports.has(importKey)) {
        imports.push({
          source,
          names,
          isDefault: nodePath.node.specifiers.some(
            (s: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier) =>
              s.type === 'ImportDefaultSpecifier'
          ),
          isDynamic: false,
        })
        seenImports.add(importKey)
      }
    },

    CallExpression(nodePath: NodePath<CallExpression>) {
      if (nodePath.node.callee.type === 'Import') {
        const arg = nodePath.node.arguments[0]
        if (arg?.type === 'StringLiteral') {
          imports.push({
            source: arg.value,
            names: ['dynamic'],
            isDefault: false,
            isDynamic: true,
          })
        }
      }
    },

    ExportNamedDeclaration(nodePath: NodePath<ExportNamedDeclaration>) {
      const decl = nodePath.node.declaration
      if (decl?.type === 'VariableDeclaration') {
        decl.declarations.forEach((d: VariableDeclarator) => {
          if (d.id.type === 'Identifier') {
            exports.push(d.id.name)
          }
        })
      } else if (decl?.type === 'FunctionDeclaration') {
        if (decl.id) {
          exports.push(decl.id.name)
        }
      } else if (decl?.type === 'ClassDeclaration') {
        if (decl.id) {
          exports.push(decl.id.name)
        }
      }

      const specifiers = nodePath.node.specifiers
      specifiers.forEach((spec) => {
        if (spec.type === 'ExportSpecifier') {
          const exp = spec.exported
          exports.push(exp.type === 'Identifier' ? exp.name : exp.value)
        }
      })

      if (nodePath.node.source) {
        const source = nodePath.node.source.value
        const names = nodePath.node.specifiers.map((spec) => {
          if (spec.type === 'ExportSpecifier') {
            const exp = spec.exported
            return exp.type === 'Identifier' ? exp.name : exp.value
          }
          return 'unknown'
        })

        reexports.push({
          source,
          names,
          isDefault: false,
          isDynamic: false,
        })
      }
    },

    ExportDefaultDeclaration(_nodePath: NodePath<ExportDefaultDeclaration>) {
      exports.push('default')
    },

    VariableDeclarator(nodePath: NodePath<VariableDeclarator>) {
      const init = nodePath.node.init
      const callArg = init?.type === 'CallExpression' ? init.arguments[0] : undefined
      if (
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === 'require' &&
        callArg?.type === 'StringLiteral'
      ) {
        let name = 'module'
        if (nodePath.node.id.type === 'Identifier') {
          name = nodePath.node.id.name
        }
        imports.push({
          source: callArg.value,
          names: [name],
          isDefault: true,
          isDynamic: false,
        })
      }
    },
  })

  return {
    imports: Array.from(
      new Map(imports.map((i) => [`${i.source}:${i.names.join(',')}`, i])).values()
    ),
    exports: Array.from(new Set(exports)),
    reexports: Array.from(
      new Map(reexports.map((r) => [`${r.source}:${r.names.join(',')}`, r])).values()
    ),
  }
}

/**
 * Resolve relative import path to potential module paths
 * @param importPath - Import path from code
 * @param fromFilePath - File path containing the import
 * @returns List of possible resolved paths
 */
export function resolveImportPath(importPath: string, fromFilePath: string): string[] {
  // If it's a node_modules package, don't resolve
  if (!importPath.startsWith('.')) {
    return [importPath] // Return as-is for package names
  }

  const fromDir = path.dirname(fromFilePath)
  const basePath = path.resolve(fromDir, importPath)

  // Generate possible paths (with and without extensions)
  const possibilities = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.jsx`,
  ]

  return possibilities
}
