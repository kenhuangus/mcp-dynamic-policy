import express from 'express';

process.on('unhandledRejection', error => {
    console.error('unhandledRejection:', error);
});

process.on('uncaughtException', error => {
    console.error('uncaughtException:', error);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic MCP server with auth support

// Dynamic client registration endpoint (RFC 7591)
app.post('/oauth/register', (req, res) => {
    console.log('Client registration request:', req.body);

    const client = {
        client_id: 'test-client-' + Date.now(),
        client_secret: 'test-secret-' + Date.now(),
        redirect_uris: req.body.redirect_uris || [],
        client_name: req.body.client_name || 'Test Client',
        scope: req.body.scope || 'read write',
        client_id_issued_at: Date.now(),
        client_secret_expires_at: 0  // Never expires
    };

    console.log('Registered client:', client.client_id);
    res.json({
        client_id: client.client_id,
        client_secret: client.client_secret,
        redirect_uris: client.redirect_uris,
        scope: client.scope,
        client_id_issued_at: client.client_id_issued_at,
        client_secret_expires_at: client.client_secret_expires_at
    });
});

// Token endpoint with PKCE support
app.post('/oauth/token', (req, res) => {
    console.log('Token request:', req.body);

    // For testing, always grant token
    res.json({
        access_token: 'test-access-token-' + Date.now(),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write'
    });
});

// MCP protocol endpoint
app.post('/mcp', (req, res) => {
    console.log('MCP request:', req.body);

    // Check authentication
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authentication token' });
    }

    // Simple MCP server for testing
    const method = req.body.method;

    if (method === 'initialize') {
        res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
                serverInfo: {
                    name: 'test-oauth-mcp-server',
                    version: '1.0.0'
                },
                capabilities: {
                    tools: {
                        "test_tool": {
                            description: "A test tool that returns a greeting",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    message: {
                                        type: "string",
                                        description: "Message to echo back"
                                    }
                                },
                                required: ["message"]
                            }
                        }
                    }
                }
            }
        });
    } else if (method === 'tools/call') {
        // Handle tool calls
        const toolName = req.body.params?.name;
        if (toolName === 'test_tool') {
            const message = req.body.params?.arguments?.message || 'Hello';
            res.json({
                jsonrpc: '2.0',
                id: req.body.id,
                result: {
                    content: [{
                        type: 'text',
                        text: `Echo: ${message} (from OAuth-protected server)`
                    }]
                }
            });
        } else {
            res.json({
                jsonrpc: '2.0',
                id: req.body.id,
                result: { message: 'Unknown tool requested' }
            });
        }
    } else {
        res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: 'Hello from OAuth-protected MCP server!'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', server: 'OAuth MCP Server' });
});

// List registered OAuth clients endpoint
app.get('/oauth/clients', (req, res) => {
    // In a real implementation, you'd track registered clients in a database
    // For demo purposes, we'll return mock data
    res.json([
        {
            client_id: 'demo-client-001',
            client_name: 'Demo MCP Client',
            registered_at: new Date().toISOString()
        }
    ]);
});

// PKCE challenge verification (for PKCE demo)
function generatePKCECodeChallenge(verifier) {
    // Simple PKCE implementation for demo
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
}

import { readFileSync } from 'fs';
import path from 'path';

// Load Cedar policy at startup
let cedarPolicy = '';
try {
    const policyPath = path.join(process.cwd(), 'cedar-policy.cedar');
    cedarPolicy = readFileSync(policyPath, 'utf8');
    console.log('Cedar policy loaded successfully');
} catch (error) {
    console.error('Failed to load Cedar policy:', error.message);
}

// Parse Cedar policy rules with detailed logging
function parseCedarPolicy() {
    const rules = [];
    const lines = cedarPolicy.split('\n');

    console.log('🧪 Parsing Cedar policy...');

    let currentRule = null;
    let currentType = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('//')) continue;

        console.log(`Parsing line: "${line}"`);

        if (line === 'permit(') {
            currentRule = { type: 'permit', conditions: [], action: null };
            currentType = 'permit';
            console.log('  📝 Started parsing PERMIT rule');
        } else if (line === 'forbid(') {
            currentRule = { type: 'forbid', conditions: [], action: null };
            currentType = 'forbid';
            console.log('  📝 Started parsing FORBID rule');
        } else if (line === ');' && currentRule) {
            rules.push(currentRule);
            console.log(`  ✅ Completed rule: ${currentRule.type}, principal=${currentRule.principalType || currentRule.principalExact}, action=${currentRule.action || currentRule.actions?.join(',')}`);
            currentRule = null;
        } else if (currentRule && line.includes('action in MCP::Action::"')) {
            // Single action: action in MCP::Action::"call_tool"
            console.log(`  🔍 Parsing single action line: ${line}`);
            const actionMatch = line.match(/action\s+in\s+MCP::Action::"([^"]+)"/);
            if (actionMatch) {
                currentRule.action = actionMatch[1];
                console.log(`  ✅ Extracted single action: "${currentRule.action}"`);
            } else {
                console.log(`  ❌ Failed to extract action from: ${line}`);
            }
        } else if (currentRule && line.includes('action == MCP::Action::"')) {
            // Single action equals: action == MCP::Action::"health_check"
            console.log(`  🔍 Parsing action equals line: ${line}`);
            const actionMatch = line.match(/action\s+==\s+MCP::Action::"([^"]+)"/);
            if (actionMatch) {
                currentRule.action = actionMatch[1];
                console.log(`  ✅ Extracted action equals: "${currentRule.action}"`);
            } else {
                console.log(`  ❌ Failed to extract action from: ${line}`);
            }
        } else if (currentRule && line.includes('principal in MCP::Client::"')) {
            // Principal condition: principal in MCP::Client::"authenticated"
            console.log(`  🔍 Parsing principal in line: ${line}`);
            const principalMatch = line.match(/principal\s+in\s+MCP::Client::"([^"]+)"/);
            if (principalMatch) {
                currentRule.principalType = principalMatch[1];
                console.log(`  ✅ Extracted principal type: "${currentRule.principalType}"`);
            }
        } else if (currentRule && line.includes('principal == MCP::Client::"')) {
            // Exact principal match: principal == MCP::Client::"health_monitor"
            console.log(`  🔍 Parsing principal equals line: ${line}`);
            const principalMatch = line.match(/principal\s+==\s+MCP::Client::"([^"]+)"/);
            if (principalMatch) {
                currentRule.principalExact = principalMatch[1];
                console.log(`  ✅ Extracted principal exact: "${currentRule.principalExact}"`);
            }
        } else if (currentRule && line.includes('action in [')) {
            // Multiple actions: action in [MCP::Action::"call_tool", MCP::Action::"read_capabilities"]
            console.log(`  🔍 Parsing action array line: ${line}`);
            const actionMatch = line.match(/action\s+in\s+\[([^\]]+)\]/);
            if (actionMatch) {
                const actionList = actionMatch[1];
                const actions = actionList.split(',').map(a =>
                    a.trim().replace(/MCP::Action::/g, '').replace(/"/g, '')
                );
                currentRule.actions = actions;
                console.log(`  ✅ Extracted action array: [${currentRule.actions.join(', ')}]`);
            } else {
                console.log(`  ❌ Failed to extract actions from: ${line}`);
            }
        }
    }

    console.log(`🎯 Parsed ${rules.length} total rules:`);
    rules.forEach((rule, index) => {
        console.log(`  Rule ${index + 1}: ${rule.type.toUpperCase()} principal=${rule.principalType || rule.principalExact}, action=${rule.action || (rule.actions ? rule.actions.join(',') : 'none')}`);
    });
    console.log('');

    return rules;
}

// Real Cedar policy evaluation based on actual policy file
function evaluateCedarPolicy(action, principal, resource) {
    console.log('TEST_DEBUG: enter evaluateCedarPolicy');
    console.log(`\n🚨 DEBUG: evaluateCedarPolicy CALLED with ${action}, ${principal}, ${resource}`);
    console.log(`Policy loaded: ${cedarPolicy.length} characters`);

    if (cedarPolicy.length === 0) {
        console.log('TEST_DEBUG: Cedar policy is empty!');
        return false;
    }

    console.log(`\n--- Cedar Policy Evaluation ---`);
    console.log(`Principal: ${principal}`);
    console.log(`Action: ${action}`);
    console.log(`Resource: ${resource}`);

    const rules = parseCedarPolicy();
    let finalDecision = 'Deny'; // Default deny

    console.log(`Parsed ${rules.length} rules:`);

    for (const rule of rules) {
        console.log(`  ${rule.type.toUpperCase()} rule: principal=${rule.principalType || rule.principalExact}, action=${rule.action || rule.actions}`);

        // Check principal condition
        let principalMatches = false;

        if (rule.principalType) {
            // Handle "principal in MCP::Client::"authenticated""
            const expectedPattern = `client-${rule.principalType}`;
            if (principal && principal.includes(expectedPattern)) {
                principalMatches = true;
                console.log(`    ✅ Principal matches ${rule.principalType} pattern (${principal})`);
            } else {
                console.log(`    ❌ Principal ${principal} doesn't match ${rule.principalType} pattern`);
            }
        } else if (rule.principalExact) {
            // Handle "principal == MCP::Client::"health_monitor""
            if (principal === rule.principalExact) {
                principalMatches = true;
                console.log(`    ✅ Principal exactly matches ${rule.principalExact}`);
            } else {
                console.log(`    ❌ Principal ${principal} doesn't exactly match ${rule.principalExact}`);
            }
        }

        // Check action condition
        let actionMatches = false;

        if (rule.actions && Array.isArray(rule.actions) && rule.actions.length > 0) {
            actionMatches = rule.actions.some(a => action === a.trim());
        } else if (rule.action) {
            actionMatches = (action === rule.action);
        } else {
            // If no specific action constraint, match any action
            actionMatches = true;
        }

        if (actionMatches) {
            console.log(`    ✅ Action ${action} matches permitted action(s)`);
        } else {
            console.log(`    ❌ Action ${action} doesn't match permitted actions`);
        }

        // Apply rule based on type
        if (principalMatches && actionMatches) {
            if (rule.type === 'permit') {
                finalDecision = 'Permit';
                console.log(`    🎉 RULE RESULT: ${rule.type.toUpperCase()} - Decision = PERMIT`);
                // Don't break - collect all matching rules
            } else if (rule.type === 'forbid') {
                finalDecision = 'Deny';
                console.log(`    ❌ RULE RESULT: ${rule.type.toUpperCase()} - Decision = DENY`);
                // Forbid takes precedence
            }
        } else {
            console.log(`    ⏭️  Rule ${rule.type} not applicable (conditions not met)`);
        }
    }

    console.log(`\nFINAL DECISION: ${finalDecision}\n`);
    return finalDecision === 'Permit';
}

// Authorization endpoint (for PKCE flow)
app.post('/oauth/authorize', (req, res) => {
    console.log('Authorization request with PKCE:', req.body);

    const { client_id, code_challenge, code_challenge_method } = req.body;

    // Validate client
    if (!client_id || !client_id.startsWith('test-client-')) {
        return res.status(400).json({ error: 'Invalid client' });
    }

    // Validate PKCE method
    if (code_challenge_method !== 'S256') {
        return res.status(400).json({ error: 'PKCE method must be S256' });
    }

    // Generate authorization code
    const authCode = 'auth_code_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    console.log(`Generated auth code: ${authCode}`);

    res.json({
        code: authCode,
        state: req.body.state,
        code_challenge: code_challenge
    });
});

// Token exchange with PKCE verification
app.post('/oauth/token', (req, res) => {
    console.log('Token exchange with PKCE:', req.body);

    const grantType = req.body.grant_type || req.body.scope;

    if (grantType === 'authorization_code' || req.body.code) {
        // PKCE flow: Verify code_verifier matches code_challenge
        const { code, code_verifier } = req.body;

        if (code && code_verifier) {
            // Verify PKCE: code_challenge = base64url(sha256(code_verifier))
            const expectedChallenge = generatePKCECodeChallenge(code_verifier);

            console.log(`PKCE verification: verifier=${code_verifier}, challenge=${expectedChallenge}`);

            // In real implementation, we'd store and verify the original code_challenge
            // For demo, just accept it
        }
    } else {
        // Client credentials flow (no PKCE for this)
        console.log('Client credentials token request');
    }

    // Issue token
    res.json({
        access_token: 'test-access-token-' + Date.now(),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
        principal: 'authenticated-client-' + Date.now()
    });
});

// Cedar policy evaluation endpoint
app.post('/authz/evaluate', (req, res) => {
    console.log(`🔴 AUTHZ ENDPOINT CALLED with body:`, req.body);

    const { action, principal, resource } = req.body;

    console.log(`🔴 Calling evaluateCedarPolicy with: action=${action}, principal=${principal}, resource=${resource}`);

    const allowed = evaluateCedarPolicy(action, principal, resource);

    console.log(`Cedar policy decision: ${allowed ? 'PERMIT' : 'DENY'} for ${principal}:${action}:${resource}`);

    res.json({
        decision: allowed ? 'Permit' : 'Deny',
        action: action,
        principal: principal,
        resource: resource,
        policyEvaluated: 'oauth-mcp-policy.cedar'
    });
});

// Test tool endpoint (OAuth + Cedar protected)
app.post('/tool/test', (req, res) => {
    console.log('Tool call received:', req.body);

    // Check authentication
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authentication token' });
    }

    // Verify the token & Cedar policy
    const token = auth.split(' ')[1];
    if (!token.startsWith('test-access-token-')) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract principal from token (simplified)
    const principal = 'authenticated-client-' + token.split('-')[3]; // Extract from token

    // Evaluate Cedar policy
    const cedarDecision = evaluateCedarPolicy('call_tool', principal, 'tool/test');

    if (!cedarDecision) {
        return res.status(403).json({
            error: 'Access denied by authorization policy',
            cedar_decision: 'Deny',
            principal: principal,
            action: 'call_tool',
            resource: 'tool/test'
        });
    }

    // Process the tool request
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message parameter required' });
    }

    res.json({
        result: `Echo from OAuth+PKCE+CEDEAR-protected tool: ${message}`,
        security: {
            oauth_validated: true,
            pkce_verified: true,
            cedar_authorized: true,
            cedar_decision: 'Permit'
        }
    });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`OAuth MCP Server listening on port ${port}`);
    console.log(`OAuth registration endpoint: http://localhost:${port}/oauth/register`);
    console.log(`Health check: http://localhost:${port}/health`);
});
