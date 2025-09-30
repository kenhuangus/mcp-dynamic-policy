#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Dynamic Policy MCP Server with LLM-Generated Cedar Policies
class DynamicPolicyMCPServer {
    constructor() {
        this.activePolicies = new Map(); // agentId -> generatedPolicy
        this.agentContexts = new Map(); // agentId -> {task, authentication, roles}
        this.llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:4000';
    }

    // Generate Cedar policy dynamically using LLM
    async generatePolicyForAgent(agentRequest) {
        const { agentId, task, authentication, roles } = agentRequest;

        console.log(`[${new Date().toISOString()}] 🤖 === STARTING LLM POLICY GENERATION ===`);
        console.log(`[${new Date().toISOString()}] 🤖 STEP 1: Agent Configuration Received`);
        console.log(`[${new Date().toISOString()}] 🤖 Agent ID: ${agentId}`);
        console.log(`[${new Date().toISOString()}] 🤖 Task: ${task}`);
        console.log(`[${new Date().toISOString()}] 🤖 Authentication Level: ${authentication}`);
        console.log(`[${new Date().toISOString()}] 🤖 Roles: ${roles.join(', ')}`);
        console.log(`[${new Date().toISOString()}] 🤖 STEP 2: Building LLM prompt...`);

        // Create LLM prompt for policy generation
        const llmPrompt = this.buildPolicyGenerationPrompt(agentRequest);

        // Call LLM service to generate policy with prompts included
        const llmResponse = await this.callLLMForPolicyAndReturnWithPrompts(llmPrompt);

        // Parse and validate the generated policy
        const validatedPolicy = await this.validateAndFormatPolicy(llmResponse.policy);

        // Store the policy for this agent
        this.activePolicies.set(agentId, validatedPolicy);
        this.agentContexts.set(agentId, { task, authentication, roles, createdAt: new Date() });

        console.log(`✅ Generated and stored dynamic policy for ${agentId}`);

        // Return detailed response including prompts for transparency
        return {
            policy: validatedPolicy,
            source: llmResponse.source || 'mock',
            generationAt: llmResponse.generationAt || new Date().toISOString(),
            prompts: llmResponse.prompts || { systemPrompt: '', userPrompt: '' }
        };
    }

    // Build LLM prompt for Cedar policy generation
    buildPolicyGenerationPrompt(request) {
        const { agentId, task, authentication, roles } = request;

        return {
            task: "Generate a Cedar authorization policy based on agent context and requirements",
            context: {
                agent_id: agentId,
                task_description: task,
                authentication_level: authentication, // "anonymous", "basic", "oauth", "mfa"
                roles: roles,
                available_actions: [
                    "portfolio_access",
                    "quote_tool",
                    "trade_using_market_order",
                    "call_tool",
                    "read_capabilities",
                    "manage_workflows",
                    "access_sensitive_data",
                    "execute_admin_actions",
                    "modify_settings"
                ],
                available_resources: [
                    "trading/*",
                    "portfolio/*",
                    "market-data/*",
                    "tools/*",
                    "workflows/dev",
                    "workflows/prod",
                    "data/sensitive",
                    "data/public",
                    "settings/system"
                ]
            },
            requirements: [
                "Generate permit/deny rules based on authentication level",
                "Limit actions based on assigned roles",
                "Restrict sensitive resources to high-trust roles",
                "Use proper Cedar syntax with MCP:: namespaces",
                "Include conditions for task-specific permissions"
            ],
            output_format: {
                policy: "Complete Cedar policy string",
                rationale: "Explain the policy decisions made",
                risk_level: "Assess security implications"
            }
        };
    }

    // Call Gemini API for policy generation
    async callLLMForPolicy(promptData) {
        const geminiApiUrl = process.env.GEMINI_API_URL;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment');
        }

        console.log('🔗 Calling Gemini API for policy generation...');

        // Format prompt for Gemini
        const systemPrompt = `# Cedar Policy Generator

You are an expert at generating Cedar authorization policies for security systems. Your task is to generate precise, secure Cedar policies based on agent context and requirements.

## Important Cedar Syntax Rules:
- Use: permit(principal, action, resource) or forbid(principal, action, resource)
- Principal types: MCP::Client::"authenticated", MCP::Client::"unauthenticated"
- Action types: MCP::Action::"call_tool", MCP::Action::"read_capabilities", etc.
- Use proper MCP:: namespaces

## Security Guidelines:
- Default deny (fail-safe approach)
- Least privilege principle
- Authentication-based scaling
- Role-appropriate restrictions
`;

        const userPrompt = `
Generate a Cedar authorization policy for this agent scenario:

AGENT CONTEXT:
- Agent ID: ${promptData.context.agent_id}
- Task: ${promptData.context.task_description}
- Authentication Level: ${promptData.context.authentication_level}
- Roles: ${promptData.context.roles.join(', ')}
- Available Actions: ${promptData.context.available_actions.join(', ')}
- Available Resources: ${promptData.context.available_resources.join(', ')}

REQUIREMENTS:
${promptData.requirements.map(req => `- ${req}`).join('\n')}

OUTPUT FORMAT:
Return JSON with:
{
  "policy": "complete cedar policy text here",
  "rationale": "explain security decisions made",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "allowed_actions": ["action1", "action2"]
}`;

        // Log the full prompt being sent to LLM
        console.log("\n" + "=".repeat(80));
        console.log("🔍 PROMPT SENT TO GOOGLE GEMINI API:");
        console.log("=".repeat(80));
        console.log("SYSTEM PROMPT:");
        console.log(systemPrompt.trim());
        console.log("\nUSER PROMPT:");
        console.log(userPrompt.trim());
        console.log("=".repeat(80) + "\n");

        const requestBody = {
            contents: [{
                parts: [{
                    text: systemPrompt + "\n\n" + userPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2000,
                topK: 1,
                topP: 0.1
            },
            safetySettings: [{
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }]
        };

        try {
            const response = await fetch(`${geminiApiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
            }

            const geminiResult = await response.json();

            console.log('✅ Gemini API response received');

            // Parse Gemini response into expected format
            const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                throw new Error('No content received from Gemini API');
            }

            // Extract JSON from response (Gemini might return JSON in text)
            let parsedResponse;
            try {
                // Try to parse as JSON directly
                parsedResponse = JSON.parse(generatedText);
            } catch (parseError) {
                // Try to extract JSON from markdown/code blocks
                const jsonMatch = generatedText.match(/```json\s*(\{[\s\S]*\})\s*```/) ||
                                generatedText.match(/```([\s\S]*?\})[\s\S]*```/) ||
                                generatedText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                } else {
                    throw new Error('Could not parse Gemini response as JSON');
                }
            }

            // Log the full response from LLM
            console.log("\n" + "=".repeat(80));
            console.log("🤖 RESPONSE RECEIVED FROM GOOGLE GEMINI API:");
            console.log("=".repeat(80));
            console.log("RAW RESPONSE TEXT:");
            console.log(generatedText);
            console.log("\nPARSED JSON RESPONSE:");
            console.log(JSON.stringify(parsedResponse, null, 2));
            console.log("=".repeat(80) + "\n");

            console.log('🍃 Gemini response parsed successfully');
            console.log(`📜 Generated policy length: ${parsedResponse.policy?.length || 0} chars`);

            return parsedResponse;

        } catch (error) {
            console.log("🚨 GEMINI API CALL FAILED - DETAILS BELOW:");
            console.log("=".repeat(50));
            console.log("❌ ERROR MESSAGE:", error.message);
            console.log("🔗 API URL:", geminiApiUrl);
            console.log("🔑 API KEY:", apiKey ? '***CONFIGURED***' : 'MISSING');
            console.log("🎯 REQUEST STATUS:", error.constructor.name);
            console.log("💡 TROUBLESHOOTING:");
            console.log("   • Check if gemini-1.5-flash is the correct model name");
            console.log("   • Verify GEMINI_API_KEY is valid");
            console.log("   • Test API connectivity to Google APIs");
            console.log("   • Check Gemini API quota/limits");
            console.log("   • Try updating to a different Gemini model");
            console.log("=".repeat(50));

            // Log the complete request that was sent
            console.log("\n📨 COMPLETE REQUEST SENT:");
            console.log(JSON.stringify(requestBody, null, 2));

            throw new Error(`Gemini API unavailable: ${error.message}. System requires working LLM for policy generation.`);
        }
    }

    // Store prompts for tracking
    lastPrompts = { systemPrompt: '', userPrompt: '' };

    // Enhanced version that includes prompts in response
    async callLLMForPolicyAndReturnWithPrompts(promptData) {
        const geminiApiUrl = process.env.GEMINI_API_URL;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment');
        }

        console.log('🔗 Calling Gemini API for policy generation...');

        // Format prompt for Gemini
        const systemPrompt = `# Cedar Policy Generator

You are an expert at generating Cedar authorization policies for security systems. Your task is to generate precise, secure Cedar policies based on agent context and requirements.

## Important Cedar Syntax Rules:
- Use: permit(principal, action, resource) or forbid(principal, action, resource)
- Principal types: MCP::Client::"authenticated", MCP::Client::"unauthenticated"
- Action types: MCP::Action::"call_tool", MCP::Action::"read_capabilities", etc.
- Use proper MCP:: namespaces

## Security Guidelines:
- Default deny (fail-safe approach)
- Least privilege principle
- Authentication-based scaling
- Role-appropriate restrictions
`;

        const userPrompt = `
Generate a Cedar authorization policy for this agent scenario:

AGENT CONTEXT:
- Agent ID: ${promptData.context.agent_id}
- Task: ${promptData.context.task_description}
- Authentication Level: ${promptData.context.authentication_level}
- Roles: ${promptData.context.roles.join(', ')}
- Available Actions: ${promptData.context.available_actions.join(', ')}
- Available Resources: ${promptData.context.available_resources.join(', ')}

REQUIREMENTS:
${promptData.requirements.map(req => `- ${req}`).join('\n')}

OUTPUT FORMAT:
Return JSON with:
{
  "policy": "complete cedar policy text here",
  "rationale": "explain security decisions made",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "allowed_actions": ["action1", "action2"]
}`;

        // Store prompts for later retrieval
        this.lastPrompts = {
            systemPrompt: systemPrompt.trim(),
            userPrompt: userPrompt.trim()
        };

        // Log the full prompt being sent to LLM
        console.log("\n" + "=".repeat(80));
        console.log("🔍 PROMPT SENT TO GOOGLE GEMINI API:");
        console.log("=".repeat(80));
        console.log("SYSTEM PROMPT:");
        console.log(systemPrompt.trim());
        console.log("\nUSER PROMPT:");
        console.log(userPrompt.trim());
        console.log("=".repeat(80) + "\n");

        try {
            const response = await fetch(`${geminiApiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: systemPrompt + "\n\n" + userPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2000,
                        topK: 1,
                        topP: 0.1
                    },
                    safetySettings: [{
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
            }

            const geminiResult = await response.json();

            // Parse and return response with prompts
            const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) {
                throw new Error('No content received from Gemini API');
            }

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(generatedText);
            } catch (parseError) {
                const jsonMatch = generatedText.match(/```json\s*(\{[\s\S]*\})\s*```/) ||
                                generatedText.match(/```([\s\S]*?\})[\s\S]*```/) ||
                                generatedText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                } else {
                    throw new Error('Could not parse Gemini response as JSON');
                }
            }

            // Log response and return with prompts
            console.log("\n" + "=".repeat(80));
            console.log("🤖 RESPONSE RECEIVED FROM GOOGLE GEMINI API:");
            console.log("=".repeat(80));
            console.log("RAW RESPONSE TEXT:");
            console.log(generatedText);
            console.log("\nPARSED JSON RESPONSE:");
            console.log(JSON.stringify(parsedResponse, null, 2));
            console.log("=".repeat(80) + "\n");

            return {
                ...parsedResponse,
                prompts: this.lastPrompts
            };

        } catch (error) {
            console.log("🚨 GEMINI API CALL FAILED - DETAILS BELOW:");
            console.log("=".repeat(50));
            console.log("❌ ERROR MESSAGE:", error.message);
            console.log("🔗 API URL:", geminiApiUrl);
            console.log("🔑 API KEY:", apiKey ? '***CONFIGURED***' : 'MISSING');

            // Still return prompts even on failure so test can show them
            throw new Error(`Gemini API unavailable: ${error.message}. System requires working LLM for policy generation.`);
        }
    }

    // Enhanced mock policy generator when LLM unavailable
    generateEnhancedMockPolicy(promptData) {
        const { context } = promptData;
        console.log('🤖 Using enhanced mock policy generation for:', context.task_description);
        console.log('🔐 Auth level:', context.authentication_level);
        console.log('🎯 Roles:', context.roles.join(', '));

        let policy = '';
        let allowedActions = [];
        let rationalStatements = [];

        // Analyze context similar to real LLM logic
        if (context.task_description.toLowerCase().includes('trade') &&
            context.roles.some(r => ['trading-agent', 'portfolio-manager', 'market-trader'].includes(r))) {
            if ((context.authentication_level === 'mfa' || context.authentication_level === 'oauth')) {
                policy = `// AI-Generated Cedar Policy for Trading Agent
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

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
);`;
                allowedActions = ['trade_using_market_order', 'portfolio_access', 'quote_tool'];
                rationalStatements = ['Trading agents require full access to trading functionality and portfolio management'];
            } else if (context.authentication_level === 'basic' &&
                      context.roles.includes('trading-agent')) {
                policy = `// AI-Generated Cedar Policy for Basic Trading Agent
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"portfolio_access",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"quote_tool",
    resource
);`;
                allowedActions = ['portfolio_access', 'quote_tool'];
                rationalStatements = ['Basic trading agents get read-only portfolio access and quotes'];
            }
        } else if (context.task_description.toLowerCase().includes('react') ||
            context.task_description.toLowerCase().includes('frontend')) {
            if (context.authentication_level === 'oauth' && context.roles.includes('developer')) {
                policy = `// AI-Generated Cedar Policy for Frontend Development
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"call_tool",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"read_capabilities",
    resource
);`;
                allowedActions = ['call_tool', 'read_capabilities'];
                rationalStatements = ['Frontend developers need tool access for UI development and component testing'];
            }
        } else if (context.task_description.toLowerCase().includes('kubernetes') ||
                   context.task_description.toLowerCase().includes('deployment')) {
            if ((context.authentication_level === 'mfa' || context.authentication_level === 'oauth') &&
                (context.roles.includes('kubernetes-admin') || context.roles.includes('devops-engineer'))) {
                policy = `// AI-Generated Cedar Policy for DevOps Deployment
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"manage_workflows",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"access_sensitive_data",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"call_tool",
    resource
);`;
                allowedActions = ['call_tool', 'manage_workflows', 'access_sensitive_data'];
                rationalStatements = ['DevOps administrators require elevated permissions for infrastructure management'];
            } else {
                policy = `// AI-Generated Cedar Policy for Standard DevOps
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"call_tool",
    resource
);`;
                allowedActions = ['call_tool'];
                rationalStatements = ['Standard DevOps role gets basic tool access for development workflows'];
            }
        } else if (context.task_description.toLowerCase().includes('security') ||
                   context.task_description.toLowerCase().includes('audit')) {
            if (context.authentication_level === 'mfa' &&
                context.roles.some(r => ['security-researcher', 'auditor', 'compliance-officer'].includes(r))) {
                policy = `// AI-Generated Cedar Policy for Security Audit
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"access_sensitive_data",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"execute_admin_actions",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"read_capabilities",
    resource
);`;
                allowedActions = ['read_capabilities', 'access_sensitive_data', 'execute_admin_actions'];
                rationalStatements = ['Security auditors and researchers need privileged access to conduct thorough assessments'];
            }
        } else if (context.task_description.toLowerCase().includes('business') ||
                   context.task_description.toLowerCase().includes('analysis')) {
            if (context.authentication_level === 'basic' &&
                context.roles.includes('business-analyst')) {
                policy = `// AI-Generated Cedar Policy for Business Analysis
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"access_sensitive_data",
    resource in MCP::Resource::"data/public"
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"call_tool",
    resource
);

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"read_capabilities",
    resource
);`;
                allowedActions = ['read_capabilities', 'call_tool', 'access_sensitive_data'];
                rationalStatements = ['Business analysts require access to public data and analytical tools within compliance boundaries'];
            }
        } else {
            // Default policy based on authentication level
            if (context.authentication_level === 'anonymous') {
                policy = `// AI-Generated Cedar Policy for Anonymous Access
// DENIED: Anonymous access violates security policies
forbid(
    principal,
    action,
    resource
);`;
                allowedActions = [];
                rationalStatements = ['Anonymous access is denied to maintain security invariants'];
            } else {
                policy = `// AI-Generated Cedar Policy for Default Authenticated Access
// Context: ${context.task_description}
// Auth: ${context.authentication_level}
// Roles: ${context.roles.join(', ')}

permit(
    principal in MCP::Client::"authenticated",
    action == MCP::Action::"read_capabilities",
    resource
);`;
                allowedActions = ['read_capabilities'];
                rationalStatements = ['Default policy provides minimal access for authenticated users'];
            }
        }

        // Determine AI-assessed risk level
        const riskLevel = context.authentication_level === 'mfa' ? 'LOW' :
                         context.authentication_level === 'oauth' ? 'MEDIUM' :
                         context.authentication_level === 'basic' ? 'HIGH' :
                         'CRITICAL';

        console.log(`📊 AI Risk Assessment: ${riskLevel}`);
        console.log(`🎯 Allowed Actions: ${allowedActions.join(', ')}`);

        return {
            policy: policy.trim(),
            rationale: rationalStatements.join('. '),
            risk_level: riskLevel,
            allowed_actions: allowedActions,
            ai_generated: true,
            generation_method: 'enhanced_mock_fallback'
        };
    }

    // Validate and format generated policy
    async validateAndFormatPolicy(generatedPolicy) {
        // Basic validation - ensure it's valid Cedar syntax
        if (!generatedPolicy.includes('permit(') && !generatedPolicy.includes('forbid(')) {
            throw new Error('Generated policy is not valid Cedar syntax');
        }

        // Add header and formatting
        const formattedPolicy = `// Dynamically generated policy for MCP server access
// Generated at: ${new Date().toISOString()}
// Agent: ${this.agentId}

${generatedPolicy}

`;

        console.log('✅ Policy validated and formatted');
        return formattedPolicy;
    }

    // Evaluate request against agent's dynamic policy
    async evaluateAuthZ(action, principal, resource, agentId) {
        console.log(`[${new Date().toISOString()}] 🔐 STEP: Starting Authorization Evaluation`);
        console.log(`[${new Date().toISOString()}] 🔐 Agent ID: ${agentId}`);
        console.log(`[${new Date().toISOString()}] 🔐 Principal: ${principal}`);
        console.log(`[${new Date().toISOString()}] 🔐 Action: ${action}`);
        console.log(`[${new Date().toISOString()}] 🔐 Resource: ${resource}`);

        // Get the agent's generated policy
        const policy = this.activePolicies.get(agentId);

        if (!policy) {
            console.log(`[${new Date().toISOString()}] ❌ POLICY LOAD ERROR: No policy found for agent ${agentId}`);
            return false;
        }

        console.log(`[${new Date().toISOString()}] ✅ Policy loaded: ${policy.length} chars`);

        console.log(`[${new Date().toISOString()}] 📋 STEP: Parsing and evaluating policy rules...`);

        // Parse and evaluate the policy
        const allowed = this.evaluatePolicyAgainstRequest(policy, action, principal, resource);

        console.log(`[${new Date().toISOString()}] 🚦 FINAL POLICY DECISION: ${allowed ? 'PERMIT ✅' : 'DENY ❌'}`);
        console.log(`[${new Date().toISOString()}] 🚦 Request Summary: ${principal}:${action}:${resource} -> ${allowed ? 'ALLOWED' : 'BLOCKED'}`);

        return allowed;
    }

    // Parse and evaluate dynamic policy
    evaluatePolicyAgainstRequest(policyText, action, principal, resource) {
        // Split policy into rules
        const rules = this.parsePolicyRules(policyText);
        let decision = 'Deny'; // Default deny

        for (const rule of rules) {
            if (this.matchRule(rule, action, principal, resource)) {
                if (rule.type === 'permit') {
                    decision = 'Permit';
                } else if (rule.type === 'forbid') {
                    decision = 'Deny';
                    break; // Forbid takes precedence
                }
            }
        }

        return decision === 'Permit';
    }

    // Parse complex policy rules
    parsePolicyRules(policyText) {
        console.log(`[${new Date().toISOString()}] 📋 PARSING POLICY TEXT (length: ${policyText.length} chars)`);

        const rules = [];
        const lines = policyText.split('\n');

        let currentRule = null;

        console.log(`[${new Date().toISOString()}] 📋 Processing ${lines.length} policy lines...`);

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.startsWith('//')) continue;

            console.log(`[${new Date().toISOString()}] 📋 Line ${i+1}: "${line}"`);

            if (line === 'permit(') {
                currentRule = { type: 'permit', principalType: null, action: null };
                console.log(`[${new Date().toISOString()}] 📋 Started parsing PERMIT rule`);
            } else if (line === 'forbid(') {
                currentRule = { type: 'forbid', principalType: null, action: null };
                console.log(`[${new Date().toISOString()}] 📋 Started parsing FORBID rule`);
            } else if (line === ');' && currentRule) {
                if (currentRule.principalType || currentRule.action) {
                    rules.push(currentRule);
                    console.log(`[${new Date().toISOString()}] 📋 Completed rule: ${currentRule.type}, principal:${currentRule.principalType}, action:${currentRule.action}`);
                }
                currentRule = null;
            } else if (currentRule && line.includes('principal in MCP::Client::"')) {
                const match = line.match(/principal\s+in\s+MCP::Client::"([^"]+)"/);
                if (match) {
                    currentRule.principalType = match[1];
                    console.log(`[${new Date().toISOString()}] 📋 Found principal type: "${currentRule.principalType}"`);
                }
            } else if (currentRule && line.includes('action in MCP::Action::"')) {
                const match = line.match(/action\s+in\s+MCP::Action::"([^"]+)"/);
                if (match) {
                    currentRule.action = match[1];
                    console.log(`[${new Date().toISOString()}] 📋 Found action type (in): "${currentRule.action}"`);
                }
            } else if (currentRule && line.includes('action == MCP::Action::"')) {
                const match = line.match(/action\s+==\s+MCP::Action::"([^"]+)"/);
                if (match) {
                    currentRule.action = match[1];
                    console.log(`[${new Date().toISOString()}] 📋 Found action type (==): "${currentRule.action}"`);
                }
            }
        }

        console.log(`[${new Date().toISOString()}] 📋 PARSED ${rules.length} POLICY RULES:`);
        rules.forEach((rule, index) => {
            console.log(`[${new Date().toISOString()}] 📋 Rule ${index+1}: ${rule.type} | principal:${rule.principalType} | action:${rule.action}`);
        });

        return rules;
    }

    // Check if request matches rule conditions
    matchRule(rule, action, principal, resource) {
        console.log(`[${new Date().toISOString()}] 🎯 TESTING RULE MATCH:`);
        console.log(`[${new Date().toISOString()}] 🎯 Rule: ${rule.type} | principal:${rule.principalType} | action:${rule.action}`);
        console.log(`[${new Date().toISOString()}] 🎯 Request: principal="${principal}" | action="${action}" | resource="${resource}"`);

        // Check principal type if specified
        if (rule.principalType) {
            console.log(`[${new Date().toISOString()}] 🎯 Principal type required: "${rule.principalType}"`);

            // Handle different principal formats:
            // - "authenticated-agent123" (test format)
            // - "authenticated" (Cedar principal type)
            // - "unauthenticated" (Cedar principal type)
            const isAuthenticatedMatch = rule.principalType === 'authenticated' &&
                (principal.startsWith('authenticated-') || principal === 'authenticated');
            const isUnauthenticatedMatch = rule.principalType === 'unauthenticated' &&
                (principal.startsWith('unauthenticated-') || principal === 'unauthenticated');

            console.log(`[${new Date().toISOString()}] 🎯 Principal matching:`);
            console.log(`[${new Date().toISOString()}] 🎯   Input principal: "${principal}"`);
            console.log(`[${new Date().toISOString()}] 🎯   Required type: "${rule.principalType}"`);
            console.log(`[${new Date().toISOString()}] 🎯   Authenticated match: ${isAuthenticatedMatch}`);
            console.log(`[${new Date().toISOString()}] 🎯   Unauthenticated match: ${isUnauthenticatedMatch}`);

            if (!isAuthenticatedMatch && !isUnauthenticatedMatch) {
                console.log(`[${new Date().toISOString()}] ❌ PRINCIPAL MISMATCH - Rule does not match principals`);
                return false;
            }

            console.log(`[${new Date().toISOString()}] ✅ Principal matches rule`);
        } else {
            console.log(`[${new Date().toISOString()}] 🎯 No principal type restriction in rule`);
        }

        // Check action if specified
        if (rule.action && action !== rule.action) {
            console.log(`[${new Date().toISOString()}] ❌ ACTION MISMATCH - Required: "${rule.action}", Got: "${action}"`);
            return false;
        }

        console.log(`[${new Date().toISOString()}] ✅ RULE MATCH SUCCESSFUL - This rule applies to the request`);
        return true;
    }

    // Get policy metrics for monitoring
    getPolicyMetrics() {
        return {
            totalPolicies: this.activePolicies.size,
            activeAgents: Array.from(this.agentContexts.keys()),
            policiesGenerated: Array.from(this.activePolicies.entries()).map(([agentId, policy]) => ({
                agentId,
                policyLength: policy.length,
                context: this.agentContexts.get(agentId)
            }))
        };
    }
}

// Server instance
const dynamicPolicyServer = new DynamicPolicyMCPServer();

// API Endpoints for Dynamic Policy Management

// Generate policy for an agent
app.post('/api/policies/generate', async (req, res) => {
    try {
        const agentRequest = req.body;
        console.log('🎯 Policy generation request:', agentRequest);

        const policy = await dynamicPolicyServer.generatePolicyForAgent(agentRequest);

        res.json({
            success: true,
            policy: policy,
            agentId: agentRequest.agentId,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Policy generation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Evaluate authorization request
app.post('/api/authz/evaluate', async (req, res) => {
    try {
        const { action, principal, resource, agentId } = req.body;
        console.log(`🔍 Authorization request: agent=${agentId}, principal=${principal}, action=${action}`);

        const allowed = await dynamicPolicyServer.evaluateAuthZ(action, principal, resource, agentId);

        res.json({
            decision: allowed ? 'Permit' : 'Deny',
            agentId: agentId,
            action, principal, resource,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('AuthZ evaluation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get policy metrics
app.get('/api/policies/metrics', (req, res) => {
    const metrics = dynamicPolicyServer.getPolicyMetrics();
    res.json(metrics);
});

// Get specific agent's policy
app.get('/api/policies/:agentId', (req, res) => {
    const agentId = req.params.agentId;
    const policy = dynamicPolicyServer.activePolicies.get(agentId);
    const context = dynamicPolicyServer.agentContexts.get(agentId);

    if (!policy) {
        return res.status(404).json({ error: 'Policy not found for agent' });
    }

    res.json({
        agentId,
        policy,
        context,
        createdAt: context?.createdAt
    });
});

// MCP protocol endpoint (enhanced with dynamic policies)
app.post('/mcp', async (req, res) => {
    console.log('🎯 MCP request received');

    // Extract agent identity (from auth header or body)
    const agentId = req.headers['x-agent-id'] || 'default-agent';
    const authToken = req.headers.authorization;

    // Ensure agent has a dynamic policy
    if (!dynamicPolicyServer.activePolicies.has(agentId)) {
        return res.status(401).json({
            error: 'No dynamic policy generated for this agent',
            required: 'POST /api/policies/generate with agent context'
        });
    }

    // Handled based on request type
    const method = req.body.method;

    if (method === 'initialize') {
        // Check if agent can read capabilities
        const canReadCapabilities = await dynamicPolicyServer.evaluateAuthZ(
            'read_capabilities',
            `authenticated-${agentId}`,
            'server/info',
            agentId
        );

        if (!canReadCapabilities) {
            return res.status(403).json({
                error: 'Access denied: cannot read server capabilities',
                cedar_decision: 'Deny'
            });
        }

        res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
                serverInfo: {
                    name: `dynamic-policy-mcp-${agentId}`,
                    version: '1.0.0',
                    description: 'MCP server with LLM-generated Cedar policies'
                },
                capabilities: {
                    tools: {
                        dynamic_tool: {
                            description: 'Dynamic tool with LLM-authorized actions',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    action: { type: 'string' },
                                    data: { type: 'object' }
                                },
                                required: ['action']
                            }
                        }
                    }
                }
            }
        });
    } else if (method === 'tools/call') {
        const toolName = req.body.params?.name;
        const action = req.body.params?.arguments?.action;

        // Check if agent is authorized for this tool action
        const allowed = await dynamicPolicyServer.evaluateAuthZ(
            action,
            `authenticated-${agentId}`,
            `tool/${toolName}`,
            agentId
        );

        if (!allowed) {
            return res.json({
                jsonrpc: '2.0',
                id: req.body.id,
                error: {
                    code: -32000,
                    message: 'Access denied by dynamic Cedar policy',
                    data: {
                        cedar_decision: 'Deny',
                        agent_id: agentId,
                        action: action,
                        resource: `tool/${toolName}`
                    }
                }
            });
        }

        // Execute the tool (simplified)
        res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
                content: [{
                    type: 'text',
                    text: `✅ Dynamic policy authorized: executed ${action} for agent ${agentId}`
                }]
            }
        });
    } else {
        res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: `Hello from dynamic policy MCP server for ${agentId}!`
        });
    }
});

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Dynamic Policy MCP Server running on port ${port}`);
    console.log(`📋 API endpoints:`);
    console.log(`   • POST /api/policies/generate - Generate policy for agent`);
    console.log(`   • POST /api/authz/evaluate - Evaluate authorization`);
    console.log(`   • GET /api/policies/:agentId - Get agent policy`);
    console.log(`   • GET /api/policies/metrics - Get policy metrics`);
    console.log(`   • POST /mcp - MCP protocol endpoint (with dynamic authz)`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Dynamic Policy MCP Server shutting down...');
    process.exit(0);
});
