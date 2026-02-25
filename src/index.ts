#!/usr/bin/env node
// Main entry point for Moltimon MCP Server

import { main } from './server.js';
import { startAdminServer, generateFirstAdminKey } from './admin-server.js';
import { setupAllCronJobs } from './cron-jobs.js';

// Check if we should generate an admin key
if (process.argv.includes('--generate-admin-key')) {
  generateFirstAdminKey();
  process.exit(0);
}

// Setup cron jobs for quest resets, leaderboard rewards, etc.
setupAllCronJobs();

// Start public MCP server
main().catch(console.error);

// Start admin REST server (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  startAdminServer().catch(console.error);
}
