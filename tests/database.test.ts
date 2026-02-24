import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { createTestDatabase } from "./setup.ts";
import { setDatabase } from "../src/database.ts";
import { getOrCreateAgent, ensureAgentExists, checkAndGiveDailyLoginPack, getTodayUTC, createPack } from "../src/database.ts";
import { handleWeeklyLeaderboardRewards } from "../src/handlers/admin.js";

let db: Database.Database;

describe("Database Module", () => {
  beforeEach(() => {
    db = createTestDatabase();
    setDatabase(db);
  });

  describe("getOrCreateAgent", () => {
    it("should return existing agent", () => {
      // Create agent first
      db.prepare("INSERT INTO agents (id, name) VALUES (?, ?)").run("existing", "Existing Agent");
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run("existing");

      const result = getOrCreateAgent("existing", "Existing Agent");
      
      expect(result.id).toBe("existing");
      expect(result.name).toBe("Existing Agent");
    });

    it("should create new agent if not exists", () => {
      const result = getOrCreateAgent("moltbook_new_agent", "New Agent");
      
      // ID should be a UUID (internal ID)
      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(10); // UUID length
      expect(result.name).toBe("New Agent");
      expect(result.moltbook_id).toBe("moltbook_new_agent");
      
      // Verify in database by Moltbook ID
      const agent = db.prepare("SELECT * FROM agents WHERE moltbook_id = ?").get("moltbook_new_agent") as any;
      expect(agent).toBeDefined();
      expect(agent.name).toBe("New Agent");
      // Should have internal UUID
      expect(agent.id).toBeDefined();
      expect(agent.id).toBe(result.id);
    });

    it("should create agent_stats for new agent", () => {
      const agent = getOrCreateAgent("moltbook_stats_test", "Stats Test Agent");
      
      const stats = db.prepare("SELECT * FROM agent_stats WHERE agent_id = ?").get(agent.id) as any;
      expect(stats).toBeDefined();
      expect(stats.elo).toBe(1000); // Default ELO
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.packs_opened).toBe(0);
    });

    it("should give signup bonus of 2 starter packs to new agents", () => {
      const agent = getOrCreateAgent("moltbook_pack_test", "Pack Test Agent");
      
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(agent.id) as any[];
      expect(packs).toHaveLength(2);
      expect(packs[0].pack_type).toBe("starter");
      expect(packs[1].pack_type).toBe("starter");
      expect(packs[0].opened).toBe(0);
      expect(packs[1].opened).toBe(0);
    });

    it("should not give signup bonus to existing agents", () => {
      // Create agent first using the new schema
      const existingId = uuidv4();
      db.prepare("INSERT INTO agents (id, moltbook_id, name) VALUES (?, ?, ?)").run(existingId, "existing_test", "Existing Agent");
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(existingId);
      
      // Get existing agent
      getOrCreateAgent("existing_test", "Existing Agent");
      
      // Should not have any packs (signup bonus only for first creation)
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(existingId) as any[];
      expect(packs).toHaveLength(0);
    });

    it("should give each new agent their own 2 starter packs", () => {
      const agent1 = getOrCreateAgent("moltbook_agent1", "Agent One");
      const agent2 = getOrCreateAgent("moltbook_agent2", "Agent Two");
      
      const agent1Packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(agent1.id) as any[];
      const agent2Packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(agent2.id) as any[];
      
      expect(agent1Packs).toHaveLength(2);
      expect(agent2Packs).toHaveLength(2);
      
      // Ensure packs have unique IDs
      const allPackIds = [...agent1Packs, ...agent2Packs].map(p => p.id);
      const uniqueIds = new Set(allPackIds);
      expect(uniqueIds.size).toBe(4);
    });

    it("should give signup bonus via ensureAgentExists for new agents", () => {
      const agent = getOrCreateAgent("moltbook_ensure_test", "Ensure New Agent");
      
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(agent.id) as any[];
      expect(packs).toHaveLength(2);
      expect(packs.every(p => p.pack_type === "starter")).toBe(true);
    });
  });

  describe("ensureAgentExists", () => {
    it("should create agent if not exists", () => {
      ensureAgentExists("moltbook_ensure_test", "Ensure Test");
      
      const agent = db.prepare("SELECT * FROM agents WHERE moltbook_id = ?").get("moltbook_ensure_test") as any;
      expect(agent).toBeDefined();
    });

    it("should not error if agent already exists", () => {
      // Create agent first using new schema
      const existsId = uuidv4();
      db.prepare("INSERT INTO agents (id, moltbook_id, name) VALUES (?, ?, ?)").run(existsId, "moltbook_exists", "Exists");
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(existsId);

      // Should not throw
      expect(() => ensureAgentExists("moltbook_exists", "Exists")).not.toThrow();
    });
  });

  describe("Daily Login Pack", () => {
    it("should give daily pack on first login", () => {
      // Create agent without login date using new schema
      const dailyTestId = uuidv4();
      db.prepare("INSERT INTO agents (id, moltbook_id, name) VALUES (?, ?, ?)").run(dailyTestId, "moltbook_daily", "Daily Test");
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(dailyTestId);

      const result = checkAndGiveDailyLoginPack(dailyTestId);

      expect(result.packGiven).toBe(true);
      expect(result.isNewDay).toBe(true);

      // Verify pack was created
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(dailyTestId) as any[];
      expect(packs).toHaveLength(1);
      expect(packs[0].pack_type).toBe("standard");
      expect(packs[0].opened).toBe(0);

      // Verify login date was updated
      const agent = db.prepare("SELECT last_login_date FROM agents WHERE id = ?").get(dailyTestId) as any;
      expect(agent.last_login_date).toBe(getTodayUTC());
    });

    it("should not give pack on same day login", () => {
      const today = getTodayUTC();
      const sameDayId = uuidv4();

      // Create agent with today's login date
      db.prepare("INSERT INTO agents (id, moltbook_id, name, last_login_date) VALUES (?, ?, ?, ?)").run(sameDayId, "moltbook_same_day", "Same Day", today);
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(sameDayId);

      const result = checkAndGiveDailyLoginPack(sameDayId);

      expect(result.packGiven).toBe(false);
      expect(result.isNewDay).toBe(false);

      // Verify no new pack was created
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(sameDayId) as any[];
      expect(packs).toHaveLength(0);
    });

    it("should give daily pack on new day", () => {
      const yesterday = "2024-01-15";
      const today = getTodayUTC();
      const newDayId = uuidv4();

      // Create agent with yesterday's login date
      db.prepare("INSERT INTO agents (id, moltbook_id, name, last_login_date) VALUES (?, ?, ?, ?)").run(newDayId, "moltbook_new_day", "New Day", yesterday);
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(newDayId);

      const result = checkAndGiveDailyLoginPack(newDayId);

      expect(result.packGiven).toBe(true);
      expect(result.isNewDay).toBe(true);

      // Verify pack was created
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(newDayId) as any[];
      expect(packs).toHaveLength(1);

      // Verify login date was updated to today
      const agent = db.prepare("SELECT last_login_date FROM agents WHERE id = ?").get(newDayId) as any;
      expect(agent.last_login_date).toBe(today);
    });

    it("should give pack each day", () => {
      // Create agent without login date
      const multiDayId = uuidv4();
      db.prepare("INSERT INTO agents (id, moltbook_id, name) VALUES (?, ?, ?)").run(multiDayId, "moltbook_multi_day", "Multi Day");
      db.prepare("INSERT INTO agent_stats (agent_id) VALUES (?)").run(multiDayId);

      // First login - should give pack
      const result1 = checkAndGiveDailyLoginPack(multiDayId);
      expect(result1.packGiven).toBe(true);

      // Update to yesterday
      const yesterday = "2024-01-15";
      db.prepare("UPDATE agents SET last_login_date = ? WHERE id = ?").run(yesterday, multiDayId);

      // Second login - should give pack again
      const result2 = checkAndGiveDailyLoginPack(multiDayId);
      expect(result2.packGiven).toBe(true);

      // Verify 2 packs
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all(multiDayId) as any[];
      expect(packs).toHaveLength(2);
    });
  });

  describe("createPack", () => {
    it("should create a pack for agent", () => {
      db.prepare("INSERT INTO agents (id, name) VALUES (?, ?)").run("pack_test", "Pack Test");

      createPack("pack_test", "premium");

      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all("pack_test") as any[];
      expect(packs).toHaveLength(1);
      expect(packs[0].pack_type).toBe("premium");
      expect(packs[0].opened).toBe(0);
      expect(packs[0].id).toBeDefined();
    });

    it("should create multiple packs of different types", () => {
      db.prepare("INSERT INTO agents (id, name) VALUES (?, ?)").run("multi_pack", "Multi Pack");

      createPack("multi_pack", "starter");
      createPack("multi_pack", "standard");
      createPack("multi_pack", "legendary");

      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ? ORDER BY pack_type").all("multi_pack") as any[];
      expect(packs).toHaveLength(3);
      expect(packs.map(p => p.pack_type)).toEqual(["legendary", "standard", "starter"]);
    });
  });

  describe("Weekly Leaderboard Rewards", () => {
    it("should give legendary packs to top 10 agents", () => {
      // Create 15 agents with varying ELO
      const agentIds: string[] = [];
      for (let i = 1; i <= 15; i++) {
        const agent = getOrCreateAgent(`moltbook_agent${i}`, `Agent ${i}`);
        agentIds.push(agent.id);
        // Set ELO from highest (1500) to lowest (800)
        db.prepare("UPDATE agent_stats SET elo = ? WHERE agent_id = ?").run(1500 - (i * 40), agent.id);
      }

      const result = handleWeeklyLeaderboardRewards();

      // Verify response structure
      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.rewards_given).toBe(10);

      // Verify each top 10 agent got a legendary pack
      for (let i = 0; i < 10; i++) {
        const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ? AND pack_type = 'legendary'").all(agentIds[i]) as any[];
        expect(packs).toHaveLength(1);
      }

      // Verify agents 11-15 got no legendary packs
      for (let i = 10; i < 15; i++) {
        const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ? AND pack_type = 'legendary'").all(agentIds[i]) as any[];
        expect(packs).toHaveLength(0);
      }
    });

    it("should not give duplicate rewards in same week", () => {
      // Create agent with high ELO
      const topAgent = getOrCreateAgent("moltbook_top_agent", "Top Agent");
      db.prepare("UPDATE agent_stats SET elo = ? WHERE agent_id = ?").run(2000, topAgent.id);

      // First call - should give reward
      const result1 = handleWeeklyLeaderboardRewards();
      const data1 = JSON.parse(result1.content[0].text);
      expect(data1.rewards_given).toBe(1);

      // Second call same week - should not give reward
      const result2 = handleWeeklyLeaderboardRewards();
      const data2 = JSON.parse(result2.content[0].text);
      expect(data2.rewards_given).toBe(0);

      // Verify only one legendary pack
      const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ? AND pack_type = 'legendary'").all(topAgent.id) as any[];
      expect(packs).toHaveLength(1);
    });

    it("should update weekly_leaderboard_rank and last_weekly_reward", () => {
      // Create top agent
      const rankedAgent = getOrCreateAgent("moltbook_ranked_agent", "Ranked Agent");
      db.prepare("UPDATE agent_stats SET elo = ? WHERE agent_id = ?").run(2500, rankedAgent.id);

      handleWeeklyLeaderboardRewards();

      const stats = db.prepare("SELECT weekly_leaderboard_rank, last_weekly_reward FROM agent_stats WHERE agent_id = ?").get(rankedAgent.id) as any;
      expect(stats.weekly_leaderboard_rank).toBe(1);
      // Bug 17 fix: last_weekly_reward is now a week number (integer), not a date string
      expect(typeof stats.last_weekly_reward).toBe('number');
      expect(stats.last_weekly_reward).toBeGreaterThan(0);
    });

    it("should handle empty leaderboard", () => {
      const result = handleWeeklyLeaderboardRewards();
      const data = JSON.parse(result.content[0].text);
      expect(data.rewards_given).toBe(0);
      expect(data.rewards).toHaveLength(0);
    });
  });
});