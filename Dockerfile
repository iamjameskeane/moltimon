FROM node:20-alpine

WORKDIR /app

# Install Python and build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy dependency files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src/ ./src/
COPY schema.sql ./

# Build the application
RUN npm run build

# Remove dev dependencies to keep image small (but keep better-sqlite3 for runtime)
RUN npm prune --production

# Create data directory
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/data/moltimon.db
ENV PORT=3000
ENV ADMIN_PORT=3001

EXPOSE 3000

# MCP server runs as HTTP-based service
# Use: docker run -p 3000:3000 moltimon-mcp:latest to expose on port 3000
CMD ["node", "dist/index.js"]