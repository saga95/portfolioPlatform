# PromptDeploy

> Prompt to SaaS — deploy your idea in minutes.

PromptDeploy is an open-core platform that transforms natural language prompts into fully deployed SaaS applications on AWS. Users describe what they want, and the platform generates code, infrastructure, and deploys it to their own AWS account.

## Architecture

- **NX Monorepo** — Integrated workspace with enforced module boundaries
- **Clean Architecture + DDD** — Domain-driven design with 5 bounded contexts
- **React + MUI** — Material UI dashboard for project management
- **Serverless Backend** — Node.js Lambda handlers with Middy middleware
- **AWS CDK** — Infrastructure as Code with reusable L3 constructs
- **Multi-Agent System** — AI agents for requirement analysis, design, code generation, QA, and security review

## Packages

| Package | Description | Tags |
|---------|-------------|------|
| `@promptdeploy/shared-types` | TypeScript interfaces shared across bounded contexts | `scope:shared` |
| `@promptdeploy/shared-utils` | Common utilities (Result type, Guard, ID generation) | `scope:shared` |
| `@promptdeploy/core` | Domain entities, value objects, use cases (Clean Architecture) | `scope:backend`, `type:domain` |
| `@promptdeploy/api` | Lambda handlers, Middy middleware, Zod schemas | `scope:backend`, `type:interface` |
| `@promptdeploy/dashboard` | React/MUI frontend application | `scope:frontend` |
| `@promptdeploy/cdk-constructs` | Reusable CDK L3 constructs | `scope:infra` |
| `@promptdeploy/infra` | CDK stacks composing constructs for deployment | `scope:infra` |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- AWS CLI configured
- AWS CDK CLI (`npm i -g aws-cdk`)

### Setup

```bash
# Clone the repository
git clone https://github.com/saga95/portfolioPlatform.git
cd portfolioPlatform

# Install dependencies
pnpm install

# Run all tests
pnpm test

# Start dashboard dev server
pnpm nx serve @promptdeploy/dashboard

# Build all packages
pnpm build
```

### NX Commands

```bash
# Run tests for affected packages only
pnpm nx affected -t test

# Lint affected packages
pnpm nx affected -t lint

# View dependency graph
pnpm nx graph

# Format all files
pnpm run format
```

## Development Standards

- **Conventional Commits** — All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) spec (enforced via Commitlint + Husky)
- **TDD** — Write tests first, then implement
- **Clean Architecture** — Domain layer has zero external dependencies
- **Module Boundaries** — NX enforces import rules between packages via scope/type tags

## Compliance

This project is designed to comply with:
- **ISO 27001:2022** — Information Security Management
- **ISO 9001:2015** — Quality Management System
- **SOC 2 Type II** — Trust Service Criteria

## License

MIT — see [LICENSE](LICENSE) for details.
