import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase, seedTestData } from "./setup.ts";
import { setDatabase } from "../src/database.ts";
import Database from "better-sqlite3";

describe("Foreign Key Constraint Tests (Bug 13)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    setDatabase(db);
    seedTestData(db);
  });

  it("should not fail with FOREIGN KEY constraint when creating battles", () => {
    const uniqueId = `test_${Date.now()}`;
    // Create agents first
    db.prepare(`INSERT INTO agents (id, name) VALUES (?, ?)`).run(`challenger_${uniqueId}`, "Challenger");
    db.prepare(`INSERT INTO agents (id, name) VALUES (?, ?)`).run(`defender_${uniqueId}`, "Defender");
    db.prepare(`INSERT INTO agent_stats (agent_id) VALUES (?)`).run(`challenger_${uniqueId}`);
    db.prepare(`INSERT INTO agent_stats (agent_id) VALUES (?)`).run(`defender_${uniqueId}`);

    // Get existing template ID
    const template = db.prepare("SELECT id FROM card_templates LIMIT 1").get() as { id: number };

    // Create cards with existing template
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run(`card1_${uniqueId}`, template.id, "common", 1, `challenger_${uniqueId}`);
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run(`card2_${uniqueId}`, template.id, "rare", 2, `defender_${uniqueId}`);

    // This should not throw FOREIGN KEY constraint error
    expect(() => {
      db.prepare(`
        INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(`battle1_${uniqueId}`, `challenger_${uniqueId}`, `defender_${uniqueId}`, `card1_${uniqueId}`, "pending");
    }).not.toThrow();

    // Verify the battle was created
    const battle = db.prepare("SELECT * FROM battles WHERE id = ?").get(`battle1_${uniqueId}`);
    expect(battle).toBeDefined();
  });

  it("should not fail with FOREIGN KEY constraint when creating trades", () => {
    // Create agents first
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-trader1", "Fx Trader 1");
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-trader2", "Fx Trader 2");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-trader1");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-trader2");

    // Get existing template ID
    const template = db.prepare("SELECT id FROM card_templates LIMIT 1").get() as { id: number };

    // Create cards with existing template
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run("fx-trade-card-1", template.id, "common", 100, "fx-trader1");
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run("fx-trade-card-2", template.id, "rare", 200, "fx-trader2");

    // This should not throw FOREIGN KEY constraint error
    expect(() => {
      db.prepare(`
        INSERT INTO trades (id, from_agent_id, to_agent_id, offered_card_ids, wanted_card_ids, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("fx-trade-1", "fx-trader1", "fx-trader2", JSON.stringify(["fx-trade-card-1"]), JSON.stringify(["fx-trade-card-2"]), "pending");
    }).not.toThrow();

    // Verify the trade was created
    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get("fx-trade-1");
    expect(trade).toBeDefined();
  });

  it("should not fail with FOREIGN KEY constraint when creating marketplace listings", () => {
    // Create agent
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-seller", "Fx Seller");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-seller");

    // Get existing template ID
    const template = db.prepare("SELECT id FROM card_templates LIMIT 1").get() as { id: number };

    // Create card with existing template
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run("fx-market-card-1", template.id, "rare", 500, "fx-seller");

    // This should not throw FOREIGN KEY constraint error
    expect(() => {
      db.prepare(`
        INSERT INTO marketplace (id, card_id, seller_agent_id, price, status)
        VALUES (?, ?, ?, ?, ?)
      `).run("fx-listing-1", "fx-market-card-1", "fx-seller", 100, "active");
    }).not.toThrow();

    // Verify the listing was created
    const listing = db.prepare("SELECT * FROM marketplace WHERE id = ?").get("fx-listing-1");
    expect(listing).toBeDefined();
  });

  it("should handle multiple cards in battles", () => {
    // Create agents
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-challenger", "Fx Challenger");
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-defender", "Fx Defender");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-challenger");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-defender");

    // Get existing template ID
    const template = db.prepare("SELECT id FROM card_templates LIMIT 1").get() as { id: number };

    // Create cards
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run("fx-battle-card-1", template.id, "common", 300, "fx-challenger");
    db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
      .run("fx-battle-card-2", template.id, "rare", 400, "fx-defender");

    // Create battle
    db.prepare(`
      INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id, status)
      VALUES (?, ?, ?, ?, ?)
    `).run("fx-battle-1", "fx-challenger", "fx-defender", "fx-battle-card-1", "pending");

    // Update battle with defender card (for completed battle)
    expect(() => {
      db.prepare(`
        UPDATE battles 
        SET defender_card_id = ?, status = 'completed', winner_id = ?
        WHERE id = ?
      `).run("fx-battle-card-2", "fx-challenger", "fx-battle-1");
    }).not.toThrow();

    // Verify battle is completed
    const battle = db.prepare("SELECT * FROM battles WHERE id = ?").get("fx-battle-1") as any;
    expect(battle.status).toBe("completed");
    expect(battle.defender_card_id).toBe("fx-battle-card-2");
  });

  it("should not fail when creating packs for agents", () => {
    // Create agent
    db.prepare(`INSERT OR IGNORE INTO agents (id, name) VALUES (?, ?)`).run("fx-pack-agent", "Fx Pack Agent");
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("fx-pack-agent");

    // Create multiple packs (should not fail)
    expect(() => {
      for (let i = 0; i < 5; i++) {
        db.prepare(`
          INSERT INTO packs (id, pack_type, owner_agent_id)
          VALUES (?, ?, ?)
        `).run(`fx-pack-${i}`, "standard", "fx-pack-agent");
      }
    }).not.toThrow();

    // Verify packs were created
    const packs = db.prepare("SELECT * FROM packs WHERE owner_agent_id = ?").all("fx-pack-agent");
    expect(packs.length).toBe(5);
  });
});