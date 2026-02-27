/**
 * Network Diagram Generator
 *
 * Generates network diagrams showing network topology: subnets, load balancers,
 * firewalls, services, and communication patterns using DOT syntax.
 *
 * Note: Templates for this diagram type are served to LLMs via template_get / arch_catalogue
 * MCP tools, not read server-side by the generator.
 */

import type { DiagramContext } from '../diagram-generator-base.js'
import { DiagramGeneratorBase } from '../diagram-generator-base.js'
import type { DiagramType, DiagramCategory } from '../diagram-types.js'
import type { ComplexityAnalyzer } from '../complexity-analyzer.js'

export class NetworkDiagramGenerator extends DiagramGeneratorBase {
  constructor(
    protected networkName?: string,
    complexityAnalyzer?: ComplexityAnalyzer
  ) {
    super(complexityAnalyzer)
  }

  getType(): DiagramType {
    return 'network'
  }

  getCategory(): DiagramCategory {
    return 'conditional'
  }

  /**
   * Generate a network diagram showing topology and security boundaries.
   * Uses DOT syntax for complex network visualizations.
   */
  generateContent(_context: DiagramContext): string {
    const networkName = this.networkName ?? 'Enterprise'

    // Generate DOT-based network topology
    const diagram = `digraph ${networkName}Network {
    rankdir=LR;
    node [shape=box, style=filled];

    // External
    internet [label="Internet", shape=ellipse, fillcolor="#FFB6C1"];

    // Edge Security
    nat [label="NAT Gateway", fillcolor="#FF6347"];
    fw_edge [label="Internet Firewall", shape=pentagon, fillcolor="#FF4500"];

    // DMZ Zone
    subgraph cluster_dmz {
        label = "DMZ (Public)";
        style = "dashed";
        fillcolor = "#FFE4B5";
        lb [label="Load Balancer\n(Public IP)", fillcolor="#FFA500"];
        nat_inst [label="Egress Gateway", fillcolor="#FF6347"];
    }

    // Public Subnet
    subgraph cluster_public {
        label = "Public Subnet\n(10.0.1.0/24)";
        style = "rounded";
        fillcolor = "#E6FFFF";
        fw_public [label="Perimeter Firewall", shape=pentagon, fillcolor="#00CED1"];
        api_lb [label="Internal LB", fillcolor="#FF8C00"];
    }

    // Private Subnet
    subgraph cluster_private {
        label = "Private Subnet\n(10.0.2.0/24)";
        style = "rounded";
        fillcolor = "#E6F3FF";
        app1 [label="App Server 1\n(10.0.2.10)", fillcolor="#4A90E2"];
        app2 [label="App Server 2\n(10.0.2.11)", fillcolor="#4A90E2"];
        app3 [label="App Server 3\n(10.0.2.12)", fillcolor="#4A90E2"];
    }

    // Database Subnet
    subgraph cluster_db {
        label = "Database Subnet\n(10.0.3.0/24)";
        style = "rounded";
        fillcolor = "#F0E6FF";
        fw_db [label="Database Firewall", shape=pentagon, fillcolor="#9370DB"];
        db [label="Database Cluster\n(10.0.3.10)", shape=cylinder, fillcolor="#8B008B"];
    }

    // VPN Access
    vpn [label="VPN Gateway", shape=box, fillcolor="#87CEEB"];

    // Connections
    internet -> fw_edge;
    fw_edge -> nat;
    fw_edge -> lb;
    nat -> nat_inst;
    lb -> fw_public;
    fw_public -> api_lb;
    api_lb -> app1 [label="TCP:8080"];
    api_lb -> app2 [label="TCP:8080"];
    api_lb -> app3 [label="TCP:8080"];
    app1 -> fw_db [label="TCP:5432"];
    app2 -> fw_db [label="TCP:5432"];
    app3 -> fw_db [label="TCP:5432"];
    fw_db -> db;
    vpn -> fw_public [style="dashed", label="VPN Connection"];
    app1 -> nat_inst [label="Outbound Traffic"];
    app2 -> nat_inst [label="Outbound Traffic"];
    app3 -> nat_inst [label="Outbound Traffic"];
    nat_inst -> internet;

    // Legend
    subgraph cluster_legend {
        label = "Legend";
        style = "dotted";
        fillcolor = "#FFFACD";
        fw [label="Firewall", shape=pentagon];
        pub [label="Public", fillcolor="#FFE4B5"];
        priv [label="Private", fillcolor="#E6F3FF"];
        db_leg [label="Database", fillcolor="#F0E6FF"];
    }
}`

    return diagram
  }

  /**
   * Count network nodes for complexity analysis.
   */
  protected override countNodes(): number {
    return 13 // Internet, gateways, firewalls, LBs, servers, DB, VPN
  }

  protected override countEdges(): number {
    return 17 // Network interconnections
  }

  protected override countNestingDepth(): number {
    return 5 // Multiple subnet layers
  }
}

export default NetworkDiagramGenerator
