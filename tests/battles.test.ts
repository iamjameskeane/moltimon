import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDatabase, seedTestData } from "./setup.ts";
import { handleBattleChallenge, handleBattleAccept, handleBattleDecline } from "../src/handlers/battles.ts";
import * as database from "../src/database.ts";

describe("Battle Handlers", () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData(db);
    
    // Create test agents with stats for battles
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("challenger", "Challenger");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("challenger");
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("defender", "Defender");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("defender");
    
    // Insert test cards for battles
    db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("challenger-card", 1, "common", 1, "challenger");
    db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("defender-card", 2, "common", 2, "defender");
  });

  describe("handleBattleChallenge", () => {
    it("should create a battle challenge", () => {
      // Create a card for the challenger
      const cardId = "test-card-1";
      db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
        .run(cardId, 1, "common", 1, "challenger");

      const result = handleBattleChallenge("challenger", "defender", cardId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.battle_id).toBeDefined();
      expect(parsed.message).toContain("defender");
    });

    it("should reject challenge if card not owned", () => {
      const result = handleBattleChallenge("challenger", "defender", "non-existent-card");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("don't own");
    });
  });

  describe("handleBattleAccept", () => {
    it("should accept a battle and resolve it", () => {
      // Setup battle - use existing cards from beforeEach
      const battleId = "test-battle-1";
      const challengerCardId = "challenger-card";
      const defenderCardId = "defender-card";
      
      db.prepare(`INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id, status) VALUES (?, ?, ?, ?, ?)`)
        .run(battleId, "challenger", "defender", challengerCardId, "pending");

      const result = handleBattleAccept("defender", battleId, defenderCardId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.battle).toBeDefined();
      expect(parsed.battle.challenger).toBeDefined();
      expect(parsed.battle.defender).toBeDefined();
    });

    it("should reject if battle not found", () => {
      const result = handleBattleAccept("defender", "non-existent", "card-id");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(false);
    });

    it("should reject if defender doesn't own card", () => {
      const battleId = "test-battle-1";
      // Need to create the agent first (card is already in beforeEach)
      db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("challenger", "Challenger");
      db.prepare(`INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id, status) VALUES (?, ?, ?, ?, ?)`)
        .run(battleId, "challenger", "defender", "challenger-card", "pending");

      const result = handleBattleAccept("defender", battleId, "card-not-owned");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(false);
    });
  });

  describe("handleBattleDecline", () => {
    it("should decline a battle", () => {
      const battleId = "test-battle-1";
      // Need to create the agent first (card is already in beforeEach)
      db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("challenger", "Challenger");
      db.prepare(`INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id, status) VALUES (?, ?, ?, ?, ?)`)
        .run(battleId, "challenger", "defender", "challenger-card", "pending");

      const result = handleBattleDecline("defender", battleId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
    });
  });
});