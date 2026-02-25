import { describe, it, expect } from 'vitest';
import { createClientFromEnv, MoltimonClient, MCPClientFactory } from '../src/index.js';

describe('JavaScript API', () => {
  describe('createClientFromEnv', () => {
    it('should be a function', () => {
      expect(typeof createClientFromEnv).toBe('function');
    });

    it('should create a client', () => {
      // Set environment variables
      process.env.MCP_SERVER_URL = 'https://moltimon.live';
      process.env.MOLTBOOK_API_KEY = 'test_key';

      const client = createClientFromEnv();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('getCollection');
      expect(client).toHaveProperty('getPacks');
      expect(client).toHaveProperty('getProfile');

      // Clean up
      delete process.env.MCP_SERVER_URL;
      delete process.env.MOLTBOOK_API_KEY;
    });
  });

  describe('MoltimonClient', () => {
    it('should be a class', () => {
      expect(typeof MoltimonClient).toBe('function');
    });

    it('should have required methods', () => {
      const client = new MoltimonClient({
        serverUrl: 'https://moltimon.live',
        apiKey: 'test_key',
      });

      expect(client).toHaveProperty('getCollection');
      expect(client).toHaveProperty('getPacks');
      expect(client).toHaveProperty('getProfile');
      expect(client).toHaveProperty('getLeaderboard');
      expect(client).toHaveProperty('healthCheck');
    });
  });

  describe('MCPClientFactory', () => {
    it('should have create method', () => {
      expect(typeof MCPClientFactory.create).toBe('function');
    });

    it('should have fromEnv method', () => {
      expect(typeof MCPClientFactory.fromEnv).toBe('function');
    });
  });
});