# Zeno's Planner Schemas

This directory contains JSON schemas used by Zeno's Planner for validating project files and ensuring data consistency across projects.

## Available Schemas

### `project-overview.schema.json`
- **Purpose**: Validates the structure of `project-overview.json` files
- **Location**: Used in `zeno/.zeno/project-overview.json` for each project
- **Description**: Ensures LLM-optimized project memory files have the correct structure with project metadata, completed gates, current gate info, upcoming gates, and architecture overview

### `config.schema.json`
- **Purpose**: Validates the structure of `config.json` files
- **Location**: Used in `zeno/.zeno/config.json` for each project
- **Description**: Ensures project configuration files have the correct structure with quality thresholds, git settings, versioning rules, and hash configuration. Project name and version information is stored in `project-overview.json` as the single source of truth.

### `repo-map.schema.json`
- **Purpose**: Validates the structure of `repo-map.json` files
- **Location**: Used in `zeno/subprojects/repo-map.json` for multi-repository projects
- **Description**: Ensures repository mapping files have the correct structure with repository lists, cross-repository dependencies, and update timestamps

## Usage

These schemas can be used by:
- Zeno's Planner tool for validation during project initialization and updates
- IDEs and editors for JSON validation and autocomplete
- CI/CD pipelines for automated validation
- Future Zeno projects for consistent data structures

## Schema Guidelines

Schemas are organized by purpose and used for validation at runtime. They are independent of template loading infrastructure.
