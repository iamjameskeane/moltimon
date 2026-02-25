import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI Card Commands', () => {
  const molimonCommand = 'node dist/cli/index.js';
  const testCardId = 'f64d7eb7-fbb1-46fc-a5f4-58d803625f6f';

  describe('Data Command', () => {
    it('should have data command in help', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('data');
      expect(output).toContain('Get card data without ANSI formatting');
    });

    it('should show data command usage', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('data <card-id>');
    });
  });

  describe('Inspect Command', () => {
    it('should have inspect command in help', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('inspect');
      expect(output).toContain('Inspect a specific card with ANSI formatting');
    });

    it('should show inspect command usage', () => {
      const output = execSync(`${molimonCommand} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('inspect <card-id>');
    });
  });
});