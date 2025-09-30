// Cedar authorization policy for MCP server access
// This policy controls who can access the test MCP server

// Principal: MCP client (like Cursor)
// Action: access tools, make requests
// Resource: MCP server endpoints

// Allow authenticated MCP clients to access tools
permit(
    principal in MCP::Client::"authenticated",
    action in MCP::Action::"call_tool",
    resource
);

// Allow authorized clients to read server capabilities
permit(
    principal in MCP::Client::"authenticated",
    action in MCP::Action::"read_capabilities",
    resource
);

// Allow server health checks (no auth required for monitoring)
permit(
    principal == MCP::Client::"health_monitor",
    action == MCP::Action::"health_check",
    resource
);

// Deny all other access
forbid(
    principal,
    action,
    resource
) unless {
    principal in MCP::Client::"authenticated" &&
    action in [MCP::Action::"call_tool", MCP::Action::"read_capabilities"]
};
