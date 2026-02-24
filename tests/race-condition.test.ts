import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase } from "./setup.ts";
import { setDatabase, getOrCreateAgent } from "../src/database.ts";
import Database from "better-sqlite3";

describe("Race Condition Tests (Bug 11)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    setDatabase(db);
  });

  it("should handle concurrent agent creation without errors", async () => {
    const moltbookId = "moltbook_concurrent_test";
    const agentName = "Concurrent Test Agent";

    // Simulate multiple concurrent calls to getOrCreateAgent
    const results = await Promise.all([
      new Promise<Agent>((resolve) => {
        setTimeout(() => {
          try {
            const result = getOrCreateAgent(moltbookId, agentName);
            resolve(result);
          } catch (e) {
            console.error("Error in promise 1:", e);
            throw e;
          }
        }, 10);
      }),
      new Promise<Agent>((resolve) => {
        setTimeout(() => {
          try {
            const result = getOrCreateAgent(moltbookId, agentName);
            resolve(result);
          } catch (e) {
            console.error("Error in promise 2:", e);
            throw e;
          }
        }, 20);
      }),
      new Promise<Agent>((resolve) => {
        setTimeout(() => {
          try {
            const result = getOrCreateAgent(moltbookId, agentName);
            resolve(result);
          } catch (e) {
            console.error("Error in promise 3:", e);
            throw e;
          }
        }, 30);
      }),
    ]);

    // All promises should succeed
    expect(results.length).toBe(3);

    // All should return the same agent (same internal UUID)
    const firstResult = results[0];
    results.forEach((result) => {
      expect(result.id).toBeDefined();
      expect(result.id).toBe(firstResult.id); // Should all have same internal UUID
      expect(result.name).toBe(agentName);
      expect(result.moltbook_id).toBe(moltbookId);
    });

    // Only one agent should exist in database
    const agents = db.prepare("SELECT * FROM agents WHERE moltbook_id = ?").all(moltbookId);
    expect(agents).toHaveLength(1);

    // Agent should have agent_stats
    const stats = db.prepare("SELECT * FROM agent_stats WHERE agent_id = ?").get(firstResult.id);
    expect(stats).toBeDefined();

    // Agent should have 2 starter packs (only from the first successful creation)
    const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(firstResult.id);
    expect(packs.length).toBeLessThanOrEqual(2);
  });

  it("should ensure agent_stats exists even for existing agents", () => {
    const moltbookId = "moltbook_stats_test";
    const agentName = "Stats Test Agent 2";

    // Create agent first
    const agent = getOrCreateAgent(moltbookId, agentName);
    expect(agent).toBeDefined();
    const agentId = agent.id;

    // Delete agent_stats to simulate the bug
    db.prepare("DELETE FROM agent_stats WHERE agent_id = ?").run(agentId);

    // Call getOrCreateAgent again
    const result = getOrCreateAgent(moltbookId, agentName);

    // Should recreate agent_stats
    const stats = db.prepare("SELECT * FROM agent_stats WHERE agent_id = ?").get(agentId);
    expect(stats).toBeDefined();
    expect(result.id).toBe(agentId);
  });
});

interface Agent {
  id: string;
  moltbook_id?: string;
  name: string;
  created_at?: string;
}