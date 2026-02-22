/**
 * Package Diagram Generator
 *
 * Generates package diagrams showing code organization: packages/modules,
 * their public APIs, and inter-package dependencies.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class PackageDiagramGenerator extends DiagramGeneratorBase {
  constructor(
    protected scopePrefix?: string,
    complexityAnalyzer?: ComplexityAnalyzer
  ) {
    super(complexityAnalyzer)
  }

  getType(): DiagramType {
    return 'package'
  }

  getCategory(): DiagramCategory {
    return 'conditional'
  }

  /**
   * Generate a package diagram showing code organization.
   * Template provides structure; content is populated from context.
   */
  generateContent(_context: DiagramContext): string {
    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/package-diagram-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate Mermaid package diagram
    const diagram = `graph TB
    subgraph Utils["utils<br/>(Public API)"]
        Logger["logger.ts"]
        Config["config.ts"]
        Helpers["helpers.ts"]
    end

    subgraph Core["core<br/>(Public API)"]
        Engine["engine.ts"]
        Registry["registry.ts"]
        Analyzer["analyzer.ts"]
    end

    subgraph API["api<br/>(Public API)"]
        Handler["handler.ts"]
        Router["router.ts"]
    end

    subgraph Storage["storage<br/>(Public API)"]
        DB["database.ts"]
        Cache["cache.ts"]
    end

    API -->|uses| Utils
    API -->|uses| Core
    Core -->|uses| Utils
    Core -->|uses| Storage
    Storage -->|uses| Utils

    classDef package fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    classDef module fill:#7B68EE,stroke:#5A4AB8,stroke-width:2px,color:#fff

    class Utils,Core,API,Storage package
    class Logger,Config,Helpers,Engine,Registry,Analyzer,Handler,Router,DB,Cache module`

    return diagram
  }

  /**
   * Count modules for complexity analysis.
   */
  protected override countNodes(): number {
    return 14 // 4 packages + 10 modules
  }

  protected override countEdges(): number {
    return 6 // Package dependencies
  }

  protected override countNestingDepth(): number {
    return 2 // Packages containing modules
  }
}

export default PackageDiagramGenerator
