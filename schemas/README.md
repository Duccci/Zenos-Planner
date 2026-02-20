# Zeno's Planner Schemas

Schemas in Zeno's Planner are defined as **TypeScript/Zod schemas** in the source code. This is the single source of truth for data validation across the project.

## Schema Definitions

All schemas are defined using [Zod](https://zod.dev/) for runtime validation with full TypeScript type safety.

### Core Configuration Schemas

Located in `src/utils/config.ts`:

- **`ZenoConfigSchema`** - Project configuration validation
  - Validates: `zeno/.zeno/config.json`
  - Properties: quality thresholds, git settings, versioning, hash configuration
  - Used by: Configuration loading and validation throughout the application

- **`ProjectOverviewSchema`** - Project metadata validation
  - Validates: `zeno/.zeno/project-overview.json`
  - Properties: project name, version, gate status, completed gates, architecture overview
  - Used by: Project state management and LLM context generation

### MCP Tool Schemas

Located in `src/mcp/schemas/`:

- **Action Schemas**: Input/output validation for MCP tool handlers
  - `gates-action-schemas.ts` - Gates action validation
  - `proposal-action-schemas.ts` - Proposal action validation
  - `req-action-schemas.ts` - Requirements action validation
  - `archive-schemas.ts` - Archive action validation
  - `config-schemas.ts` - Configuration query validation
  - And others for specific tool operations

- **Common Schemas**: Shared components
  - `common-schemas.ts` - Hash, ID, timestamp, and other base types
  - `requirement-schemas.ts` - Requirement validation
  - `analysis-schemas.ts` - Analysis results

## Usage

To validate data:

```typescript
import { ZenoConfigSchema } from 'src/utils/config.js'

const result = ZenoConfigSchema.safeParse(configData)
if (!result.success) {
  console.error(result.error.issues) // Type-safe error details
}
```

## Adding New Schemas

When adding new data structures:

1. Define schema in TypeScript using Zod
2. Export both the schema and inferred type: `export type MyType = z.infer<typeof MySchema>`
3. Use in validation: `MySchema.safeParse(data)`
4. For MCP tools, register in `src/mcp/schemas/registry.ts`

## Tool Registry

The MCP tool framework uses a discriminator-based request envelope:

```typescript
{ action: string, payload?: object }
```

Per-action output schemas are validated separately, ensuring type safety across tool invocations.

Refer to `docs/mcp-tools-development.md` for guidance on designing action schemas and validators.
