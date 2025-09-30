# Test MCP Server with OAuth/OIDC support
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy the server file (created separately)
COPY server.js .

# Create package.json for simpler dependencies
RUN echo '{"name": "test-mcp-server", "version": "1.0.0", "type": "module"}' > package.json

# Install essential Node.js dependencies
RUN npm install express

EXPOSE 3000

CMD ["node", "server.js"]
