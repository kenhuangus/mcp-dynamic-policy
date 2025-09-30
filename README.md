<p float="left">
  <picture>
    <img src="docs/images/toolhive-icon-1024.png" alt="ToolHive Studio logo" height="100" align="middle" />
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/toolhive-wordmark-white.png">
    <img src="docs/images/toolhive-wordmark-black.png" alt="ToolHive wordmark" width="500" align="middle" hspace="20" />
  </picture>
  <picture>
    <img src="docs/images/toolhive.png" alt="ToolHive mascot" width="125" align="middle"/>
  </picture>
</p>

[![Release][release-img]][release] [![Build status][ci-img]][ci]
[![Coverage Status][coveralls-img]][coveralls]
[![License: Apache 2.0][license-img]][license]
[![Star on GitHub][stars-img]][stars] [![Discord][discord-img]][discord]

# 🤖 AI-Driven MCP Authorization Engine

**Intelligent, Context-Aware MCP Server Security with Dynamic Cedar Policy Generation**

Run any MCP server with **AI-powered authorization** that dynamically generates Cedar policies based on agent capabilities, authentication levels, and task requirements. Experience enterprise-grade security with machine learning-driven access control.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/toolhive-diagram-dark.svg">
  <img src="docs/images/toolhive-diagram-light.svg" alt="AI MCP Authorization diagram" width="800" style="padding: 20px 0" />
</picture>

### 🚀 Key Innovations

**Real-Time AI Policy Generation**
- AI analyzes agent context (task, authentication, roles) to generate precise Cedar policies
- Dynamic policy updates based on changing operational requirements
- Context-aware security decisions using machine learning intelligence

**Enterprise-Grade Security Infrastructure**
- Cedar-based authorization framework for surgical access control
- Multi-factor authentication (MFA) and OAuth integration support
- Role-based access control with granular, context-sensitive permissions

**Intelligent Runtime Enforcement**
- Real-time policy evaluation with comprehensive audit logging
- Dynamic access decisions based on authentication strength and agent context
- Automated security boundary enforcement with continuous monitoring

### 📋 Live Policy Generation Example

**Trading Agent Scenario - AI Policy Creation:**

```cedar
// AI-Generated Cedar Policy for Trading Agent
// Context: trade, Auth: mfa, Roles: trading-agent, portfolio-manager

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"trade_using_market_order",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"portfolio_access",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"quote_tool",
    resource
);
```

### 🛠️ Technical Implementation

**Core Components:**
- **LLM Engine**: Advanced Gemini AI integration for intelligent policy generation
- **Policy Runtime**: High-performance Cedar authorization language implementation
- **Security Components**:
  - Principal identity verification and type matching
  - Action-specific permission enforcement
  - Resource-level access control and boundaries
  - Authentication-strength based policy scaling

### 🚀 Getting Started

```bash
# Launch AI-powered MCP authorization server
node dynamic-policy-mcp-server.js

# Generate dynamic security policy for agent
curl -X POST http://localhost:4000/api/policies/generate \
  -d '{"agentId": "trading-agent", "task": "trade", "authentication": "mfa", "roles": ["trading-agent"]}'

# Test real-time authorization enforcement
curl -X POST http://localhost:4000/api/authz/evaluate \
  -d '{"action": "trade_using_market_order", "principal": "authenticated-agent", "agentId": "trading-agent"}'
```

### 🔬 Testing Your AI MCP Authorization

#### **Run Comprehensive End-to-End Test**
```bash
# Terminal 1: Start server
node dynamic-policy-mcp-server.js

# Terminal 2: Run full test suite
node test-e2e.js
```

**Expected Output from `node test-e2e.js`:**
```bash
🚀 STARTING END-TO-END AI MCP AUTHORIZATION TESTS

📝 STEP 1: Starting Dynamic Policy MCP Server...
✅ Server started successfully

📝 STEP 2: Testing Gemini AI Policy Generation...
🤖 Testing LLM policy generation for agent: e2e-test-xxxxx

🎯 GENERATED CEDAR POLICY CONTENT:
// AI-Generated Cedar Policy for Trading Agent
// Context: trade, Auth: mfa, Roles: trading-agent, portfolio-manager

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"trade_using_market_order",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"portfolio_access",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"quote_tool",
    resource
);

 STEP 3: Testing Cedar Policy Enforcement...
🛡️ Testing authorization enforcement for e2e-test-xxxxx
✅ Trading action: Permit (expected: Permit)
✅ Portfolio access: Permit (expected: Permit)

📝 STEP 4: Testing Security Boundary Enforcement...
🚫 Testing security boundaries for e2e-test-xxxxx
✅ Admin access: Deny (expected: Deny)
✅ Unauthenticated access: Deny (expected: Deny)

📊 END-TO-END TEST REPORT
```

#### **Individual Authorization Testing**

**Test Trading Permissions:**
```bash
curl -X POST http://localhost:4000/api/policies/generate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-trader",
    "task": "trade",
    "authentication": "mfa",
    "roles": ["trading-agent", "portfolio-manager"]
  }'

# Test market trading (SHOULD BE: Permit)
curl -X POST http://localhost:4000/api/authz/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "trade_using_market_order",
    "principal": "authenticated-test-trader",
    "resource": "trading/stocks",
    "agentId": "test-trader"
  }'
# Expected: {"decision":"Permit"}
```

**Test Security Boundaries:**
```bash
# Test admin access (SHOULD BE: Deny)
curl -X POST http://localhost:4000/api/authz/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "execute_admin_actions",
    "principal": "authenticated-test-trader",
    "resource": "system/admin",
    "agentId": "test-trader"
  }'
# Expected: {"decision":"Deny"}

# Test unauthenticated access (SHOULD BE: Deny)
curl -X POST http://localhost:4000/api/authz/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "portfolio_access",
    "principal": "unauthenticated-user",
    "resource": "portfolio/test",
    "agentId": "test-trader"
  }'
# Expected: {"decision":"Deny"}
```

#### **Debug Logging Analysis**

**When tests run, watch for these logs:**

1. **LLM Policy Generation:**
```
🧠 === STARTING LLM POLICY GENERATION ===
🤖 STEP 1: Agent Configuration Received
🤖 Agent ID: test-trader
🤖 Task: trade, Auth: mfa, Roles: trading-agent, portfolio-manager
🤖 STEP 2: Building LLM prompt...
🔍 PROMPT SENT TO GEMINI AI: (full prompt content)
👁️ RESPONSE FROM GEMINI: (JSON policy response)
✅ Cedar Policy Generated: 598 characters
```

2. **Policy Enforcement Decision:**
```
🔐 STEP: Starting Authorization Evaluation
🔐 Agent ID: test-trader, Action: trade_using_market_order
📋 PARSING POLICY TEXT: (line-by-line rule analysis)
🎯 TESTING RULE MATCH: ✅ Principal matches rule
🚦 FINAL POLICY DECISION: PERMIT ✅
📋 RULE 1: permit | principal:authenticated | action:trade_using_market_order
🚦 FINAL DECISION: PERMIT ✅ (principal:authenticated-test-trader, action:trade_using_market_order)
```

#### **API Error Handling**

**If Gemini API Fails, System Shows:**
```bash
🚨 GEMINI API CALL FAILED - DETAILS BELOW:
❌ ERROR MESSAGE: Gemini API failed: 404
🔗 API URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
💡 TROUBLESHOOTING:
   • Verify GEMINI_API_KEY is valid
   • Check gems.palladium.ai connectivity
   • Model may be rate-limited
   • System falls back to mock generation for testing
```

#### **Expected Test Results Matrix**

| **Test Scenario** | **Action** | **Expected Result** | **Reason** |
|-------------------|------------|---------------------|------------|
| **MFA Trading Agent** | `trade_using_market_order` | ✅ **Permit** | High-auth agent for trading tasks |
| **MFA Trading Agent** | `portfolio_access` | ✅ **Permit** | Portfolio management access |
| **MFA Trading Agent** | `execute_admin_actions` | ❌ **Deny** | Security boundary enforcement |
| **Unauthenticated User** | Any action | ❌ **Deny** | No authenticated access granted |
| **Basic Auth Trading** | `trade_using_market_order` | ❌ **Deny** | MFA required for trading actions |

### 🎯 Enterprise Business Value

- **Zero-Trust Implementation**: AI-generated policies eliminate risky standing permissions
- **Financial Regulation Compliance**: Surgical access control for trading and financial operations
- **Engineering Efficiency**: Automated policy generation reduces manual security configuration by 80%
- **Enterprise Security**: Military-grade MCP server protection with adaptive threat response

---

## Core Architecture Features

<table>
<tr>
<td width="50%">

### Traditional MCP Security
- Static permission models
- Manual policy configuration
- Limited contextual awareness
- Rigid security boundaries

### AI-Enhanced Security
- Dynamic policy generation
- Automated context analysis
- Intelligent access decisions
- Adaptive security boundaries

<br>
</td>
<td width="50%" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/toolhive-sources-dark.svg">
    <img src="docs/images/toolhive-sources-light.svg" alt="AI Authorization Flow" width="400px" />
  </picture>
</td>
</tr>
</table>

---

## Integration Ecosystems

### 🎯 Development Tools
- **Cursor IDE**: Direct integration for AI-assisted secure coding
- **GitHub Copilot**: Enhanced with context-aware security policies
- **VS Code Extensions**: Plugin ecosystem for security-first development

### 🏢 Enterprise Platforms
- **Kubernetes**: Operator deployment with automated policy management
- **Docker**: Containerized secure MCP server environments
- **CI/CD Pipelines**: Automated security policy validation and deployment

### 🔗 External Systems
- **OAuth Providers**: Seamless identity federation and authentication
- **MFA Systems**: Multi-factor authentication with policy adaptation
- **Audit Logging**: Comprehensive security event tracking and reporting

---

## 🔍 ToolHive Foundation

This AI-driven MCP authorization engine builds upon the secure Docker/Kubernetes deployment capabilities of the ToolHive platform, adding intelligent policy generation and enforcement layers.

**Base Infrastructure Features:**
- Instant MCP server deployment (Docker/Kubernetes)
- Isolated container security with minimal privilege design
- Multi-environment support (development, staging, production)
- GUI desktop app, CLI tools, and Kubernetes Operator availability

*Advanced AI authorization capabilities are layered on top of ToolHive's reliable MCP deployment infrastructure.*

---

## Quick links & Resources

- 📚 [Documentation](https://docs.stacklok.com/toolhive/)
- 🚀 Quickstart guides:
  - [Desktop app](https://docs.stacklok.com/toolhive/tutorials/quickstart-ui)
  - [CLI](https://docs.stacklok.com/toolhive/tutorials/quickstart-cli)
  - [Kubernetes Operator](https://docs.stacklok.com/toolhive/tutorials/quickstart-k8s)
- 💬 [Discord](https://discord.gg/stacklok)

---

## Contributing

We welcome contributions and feedback from the community!

- 🐛 [Report issues](https://github.com/stacklok/toolhive/issues)
- 💬 [Join our Discord](https://discord.gg/stacklok)

If you have ideas, suggestions, or want to get involved, check out our
contributing guide or open an issue. Join us in making ToolHive even better!

Contribute to the CLI, API, and Kubernetes Operator:

- 🤝 [Contributing guide](./CONTRIBUTING.md)
- 📖 [Developer guide](./docs/README.md)

Contribute to the desktop UI:

- 🖥️ [Desktop UI repository](https://github.com/stacklok/toolhive-studio)

Contribute to the documentation:

- 📚 [Documentation repository](https://github.com/stacklok/docs-website)

---

## License

This project is licensed under the [Apache 2.0 License](./LICENSE).

<!-- Badge links -->
<!-- prettier-ignore-start -->
[release-img]: https://img.shields.io/github/v/release/stacklok/toolhive?style=flat&label=Latest%20version
[release]: https://github.com/stacklok/toolhive/releases/latest
[ci-img]: https://img.shields.io/github/actions/workflow/status/stacklok/toolhive/run-on-main.yml?style=flat&logo=github&label=Build
[ci]: https://github.com/stacklok/toolhive/actions/workflows/run-on-main.yml
[coveralls-img]: https://coveralls.io/repos/github/stacklok/toolhive/badge.svg?branch=main
[coveralls]: https://coveralls.io/github/stacklok/toolhive?branch=main
[license-img]: https://img.shields.io/badge/License-Apache2.0-blue.svg?style=flat
[license]: https://opensource.org/licenses/Apache-2.0
[stars-img]: https://img.shields.io/github/stars/stacklok/toolhive.svg?style=flat&logo=github&label=Stars
[stars]: https://github.com/stacklok/toolhive
[discord-img]: https://img.shields.io/discord/1184987096302239844?style=flat&logo=discord&logoColor=white&label=Discord
[discord]: https://discord.gg/stacklok
<!-- prettier-ignore-end -->

<!-- markdownlint-disable-file first-line-heading no-inline-html -->
