import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI Tool (moltimon)', () => {
  const molimonCommand = 'node dist/cli/index.js';

  describe('Help and Version', () => {
    it('should show help when called with --help', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('Usage: moltimon');
      expect(output).toContain('Commands:');
    });

    it('should show version when called with --version', () => {
      const output = execSync(`${molimonCommand} --version`, {
        encoding: 'utf8',
      });
      expect(output).toContain('0.1.0');
    });
  });

  describe('Configuration', () => {
    it('should have config command', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('config');
    });
  });

  describe('Health Check', () => {
    it('should have health command', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('health');
    });
  });

  describe('Data Command', () => {
    it('should have data command', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('data');
    });
  });

  describe('Inspect Command', () => {
    it('should have inspect command', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('inspect');
    });
  });
});