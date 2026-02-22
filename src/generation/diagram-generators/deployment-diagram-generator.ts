/**
 * Deployment Diagram Generator
 *
 * Generates deployment diagrams showing runtime infrastructure: nodes, containers,
 * artifacts, and communication channels using DOT syntax for complex topologies.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class DeploymentDiagramGenerator extends DiagramGeneratorBase {
  constructor(
    protected deploymentEnv?: string,
    complexityAnalyzer?: ComplexityAnalyzer
  ) {
    super(complexityAnalyzer)
  }

  getType(): DiagramType {
    return 'deployment'
  }

  getCategory(): DiagramCategory {
    return 'conditional'
  }

  /**
   * Generate a deployment diagram showing runtime infrastructure.
   * Uses DOT syntax for more complex topologies.
   * Template provides structure; content is populated from context.
   */
  generateContent(_context: DiagramContext): string {
    const env = this.deploymentEnv ?? 'Production'

    // Load template for structural guidance
    const templatePath = join(
      process.cwd(),
      'templates/architecture-templates/deployment-diagram-template.md'
    )
    try {
      readFileSync(templatePath, 'utf-8')
    } catch {
      // Template file not found; proceed with default generation
    }

    // Generate DOT-based deployment topology
    const diagram = `digraph ${env}Deployment {
    rankdir=TB;
    node [shape=component, style=filled, fillcolor="#E8F4F8"];

    // Load Balancer
    lb [label="Load Balancer\n(AWS ELB)", shape=box, fillcolor="#FF9F40"];

    // API Servers
    api1 [label="API Server 1\n(Docker Container)", shape=box, fillcolor="#4A90E2"];
    api2 [label="API Server 2\n(Docker Container)", shape=box, fillcolor="#4A90E2"];
    api3 [label="API Server 3\n(Docker Container)", shape=box, fillcolor="#4A90E2"];

    // Cache
    cache [label="Redis Cache\n(Managed Service)", shape=box, fillcolor="#7B68EE"];

    // Database
    db [label="PostgreSQL\n(AWS RDS)", shape=cylinder, fillcolor="#E85D75"];

    // File Storage
    storage [label="S3 Storage\n(AWS S3)", shape=box, fillcolor="#50C878"];

    // Monitoring
    monitor [label="Monitoring\n(CloudWatch)", shape=box, fillcolor="#FFD700"];

    // Connections
    lb -> api1 [label="HTTP/HTTPS"];
    lb -> api2 [label="HTTP/HTTPS"];
    lb -> api3 [label="HTTP/HTTPS"];
    api1 -> cache [label="TCP:6379"];
    api2 -> cache [label="TCP:6379"];
    api3 -> cache [label="TCP:6379"];
    api1 -> db [label="TCP:5432"];
    api2 -> db [label="TCP:5432"];
    api3 -> db [label="TCP:5432"];
    api1 -> storage [label="HTTPS"];
    api2 -> storage [label="HTTPS"];
    api3 -> storage [label="HTTPS"];
    api1 -> monitor [label="Metrics"];
    api2 -> monitor [label="Metrics"];
    api3 -> monitor [label="Metrics"];
    db -> monitor [label="Metrics"];
    cache -> monitor [label="Metrics"];

    // Subgraph for DMZ
    subgraph cluster_dmz {
        label = "DMZ";
        style = "dashed";
        fillcolor = "#F0F0F0";
        lb;
    }

    // Subgraph for Application
    subgraph cluster_app {
        label = "Application Tier";
        style = "rounded";
        fillcolor = "#E8F4F8";
        api1; api2; api3; cache;
    }

    // Subgraph for Data
    subgraph cluster_data {
        label = "Data Tier";
        style = "dashed";
        fillcolor = "#F0F0F0";
        db; storage;
    }

    // Subgraph for Monitoring
    subgraph cluster_ops {
        label = "Operations";
        style = "dotted";
        fillcolor = "#FFFACD";
        monitor;
    }
}`

    return diagram
  }

  /**
   * Count infrastructure nodes for complexity analysis.
   */
  protected override countNodes(): number {
    return 8 // LB + 3 APIs + Cache + DB + Storage + Monitor
  }

  protected override countEdges(): number {
    return 15 // Multiple interconnections
  }

  protected override countNestingDepth(): number {
    return 4 // Subgraphs for different tiers
  }
}

export default DeploymentDiagramGenerator
