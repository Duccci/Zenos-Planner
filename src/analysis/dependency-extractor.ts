/**
 * Dependency extractor using Babel AST traversal
 * Identifies imports, exports, and re-exports from parsed code
 */

/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/restrict-template-expressions */

// Babel traverse typing is complex, use lazy loading
let traverse: any = null

function getTraverse(): any {
  if (!traverse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const traverseModule = require('@babel/traverse')
    traverse = traverseModule.default ?? traverseModule
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

  getTraverse()(ast as any, {
    ImportDeclaration(nodePath: any) {
      const source = nodePath.node.source.value
      const names = nodePath.node.specifiers.map((spec: any) => {
        if (spec.type === 'ImportSpecifier') {
          return spec.imported.name
        }
        if (spec.type === 'ImportDefaultSpecifier') {
          return spec.local.name
        }
        if (spec.type === 'ImportNamespaceSpecifier') {
          return '*'
        }
        return 'unknown'
      })

      const importKey = `${source}:${names.join(',')}`
      if (!seenImports.has(importKey)) {
        imports.push({
          source,
          names,
          isDefault: nodePath.node.specifiers.some((s: any) => s.type === 'ImportDefaultSpecifier'),
          isDynamic: false,
        })
        seenImports.add(importKey)
      }
    },

    CallExpression(nodePath: any) {
      if (nodePath.node.callee.type === 'Import' && nodePath.node.arguments.length > 0) {
        const arg = nodePath.node.arguments[0]
        if (arg.type === 'StringLiteral') {
          imports.push({
            source: arg.value,
            names: ['dynamic'],
            isDefault: false,
            isDynamic: true,
          })
        }
      }
    },

    ExportNamedDeclaration(nodePath: any) {
      if (nodePath.node.declaration) {
        if (nodePath.node.declaration.type === 'VariableDeclaration') {
          nodePath.node.declaration.declarations.forEach((decl: any) => {
            if (decl.id.type === 'Identifier') {
              exports.push(decl.id.name)
            }
          })
        } else if (nodePath.node.declaration.type === 'FunctionDeclaration') {
          if (nodePath.node.declaration.id) {
            exports.push(nodePath.node.declaration.id.name)
          }
        } else if (nodePath.node.declaration.type === 'ClassDeclaration') {
          if (nodePath.node.declaration.id) {
            exports.push(nodePath.node.declaration.id.name)
          }
        }
      }

      if (nodePath.node.specifiers) {
        nodePath.node.specifiers.forEach((spec: any) => {
          if (spec.type === 'ExportSpecifier') {
            exports.push(spec.exported.name)
          }
        })
      }

      if (nodePath.node.source) {
        const source = nodePath.node.source.value
        const names =
          nodePath.node.specifiers?.map((spec: any) => {
            if (spec.type === 'ExportSpecifier') {
              return spec.exported.name
            }
            return 'unknown'
          }) ?? []

        reexports.push({
          source,
          names,
          isDefault: false,
          isDynamic: false,
        })
      }
    },

    ExportDefaultDeclaration(nodePath: any) {
      const declType = nodePath.node.declaration.type
      if (
        declType === 'Identifier' ||
        declType === 'FunctionDeclaration' ||
        declType === 'ClassDeclaration'
      ) {
        exports.push('default')
      } else {
        exports.push('default')
      }
    },

    VariableDeclarator(nodePath: any) {
      const callArg = nodePath.node.init?.arguments?.[0]
      if (
        nodePath.node.init?.type === 'CallExpression' &&
        nodePath.node.init.callee?.type === 'Identifier' &&
        nodePath.node.init.callee.name === 'require' &&
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
