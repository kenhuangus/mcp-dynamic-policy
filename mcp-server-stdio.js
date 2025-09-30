#!/usr/bin/env node

import { spawn } from 'child_process';

const dockerContainer = 'test-mcp-simple';
const containerPort = '3000';

// Start the MCP protocol communication
async function startMCPProtocol() {
    console.log('Starting OAuth-protected MCP Server (stdio mode)...');

    // Implement stdio MCP server
    process.stdin.on('data', async (data) => {
        try {
            const request = JSON.parse(data.toString());

            switch (request.method) {
                case 'initialize':
                    // Initialize response with OAuth protection info
                    process.stdout.write(JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        result: {
                            serverInfo: {
                                name: 'oauth-mcp-server',
                                version: '1.0.0'
                            },
                            capabilities: {
                                tools: {
                                    test_tool: {
                                        description: 'A test tool that demonstrates OAuth protection',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {
                                                message: {
                                                    type: 'string',
                                                    description: 'Message to echo back'
                                                }
                                            },
                                            required: ['message']
                                        }
                                    },
                                    list_oauth_clients: {
                                        description: 'List OAuth clients registered with the server',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {}
                                        }
                                    },
                                    health_check: {
                                        description: 'Check the OAuth server health',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {}
                                        }
                                    }
                                }
                            }
                        }
                    }) + '\n');
                    break;

                case 'tools/call':
                    // Route tool calls through OAuth proxy to Docker container
                    await handleToolCall(request);
                    break;

                default:
                    process.stdout.write(JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32601, message: 'Method not found' }
                    }) + '\n');
            }
        } catch (error) {
            console.error('Error processing request:', error);
        }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('OAuth MCP Server shutting down...');
        process.exit(0);
    });
}

async function handleToolCall(request) {
    const { name: toolName, arguments: args } = request.params || {};

    try {
        let result;

        switch (toolName) {
            case 'test_tool':
                // Make authenticated call to Docker container
                const testResult = await makeAuthenticatedRequest('/tool/test', {
                    message: args?.message || 'Hello OAuth World!'
                });
                result = {
                    content: [{
                        type: 'text',
                        text: `OAuth Tool Result: ${testResult}`
                    }]
                };
                break;

            case 'list_oauth_clients':
                const clients = await makeAuthenticatedRequest('/oauth/clients');
                result = {
                    content: [{
                        type: 'text',
                        text: `Registered OAuth Clients: ${JSON.stringify(clients, null, 2)}`
                    }]
                };
                break;

            case 'health_check':
                const health = await makeHttpRequest('http://localhost:3001/health');
                result = {
                    content: [{
                        type: 'text',
                        text: `Server Health: ${JSON.stringify(health, null, 2)}`
                    }]
                };
                break;

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }

        process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result
        }) + '\n');

    } catch (error) {
        process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            error: {
                code: -32000,
                message: `Tool execution failed: ${error.message}`
            }
        }) + '\n');
    }
}

async function makeAuthenticatedRequest(endpoint, data = null) {
    // First, ensure we have a valid OAuth token
    const token = await getOAuthToken();

    // Make authenticated request to Docker container
    const url = `http://localhost:3001${endpoint}`;
    const method = data ? 'POST' : 'GET';

    return await makeHttpRequest(url, method, token, data);
}

async function getOAuthToken() {
    // For demo, we'll register a client and get a token
    // In production, this would handle proper OAuth flow

    const clientReg = await makeHttpRequest('http://localhost:3001/oauth/register', 'POST', null, {
        client_name: 'mcp-client-' + Date.now()
    });

    const tokenResponse = await makeHttpRequest('http://localhost:3001/oauth/token', 'POST', null, {
        grant_type: 'client_credentials',
        client_id: clientReg.client_id,
        client_secret: clientReg.client_secret
    });

    return tokenResponse.access_token;
}

async function makeHttpRequest(url, method = 'GET', token = null, data = null) {
    const http = await import('http');
    const https = await import('https');

    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const httpModule = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const req = httpModule.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', (error) => {
            console.error('HTTP request error for', url, ':', error.message);
            reject(error);
        });

        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// Start the MCP server
startMCPProtocol();
