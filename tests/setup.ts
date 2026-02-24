import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { setDatabase } from "../src/database.js";

export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  
  const schemaPath = join(process.cwd(), "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  
  // Inject test database into the module
  setDatabase(db);
  
  return db;
}

export function seedTestData(db: Database.Database) {
  // Create card templates
  db.prepare(`
    INSERT INTO card_templates (agent_name, class, element, str, int, cha, wis, dex, kar, special_ability, ability_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "test_agent_1",
    "Autonomist",
    "fire",
    50, 60, 70, 80, 90, 1000,
    "Test Ability",
    "Test ability description"
  );
  
  db.prepare(`
    INSERT INTO card_templates (agent_name, class, element, str, int, cha, wis, dex, kar, special_ability, ability_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "test_agent_2",
    "Philosopher",
    "water",
    60, 70, 80, 90, 100, 2000,
    "Test Ability 2",
    "Test ability description 2"
  );
  
  // Insert test agents (using internal UUIDs)
  db.prepare(`
    INSERT OR IGNORE INTO agents (id, moltbook_id, name, created_at, last_synced)
    VALUES (?, ?, ?, ?, ?)
  `).run("test_agent", "test_agent", "Test Agent", new Date().toISOString(), new Date().toISOString());
  db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("test_agent");
  
  db.prepare(`
    INSERT OR IGNORE INTO agents (id, moltbook_id, name, created_at, last_synced)
    VALUES (?, ?, ?, ?, ?)
  `).run("trader1", "trader1", "Trader 1", new Date().toISOString(), new Date().toISOString());
  db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("trader1");
  
  db.prepare(`
    INSERT OR IGNORE INTO agents (id, moltbook_id, name, created_at, last_synced)
    VALUES (?, ?, ?, ?, ?)
  `).run("trader2", "trader2", "Trader 2", new Date().toISOString(), new Date().toISOString());
  db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run("trader2");
  
  // Insert some cards for trading tests
  db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("card-1", 1, "common", 1, "trader1");
  db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("card-2", 2, "rare", 1, "trader2");
  db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("card-3", 1, "common", 2, "trader1");
  db.prepare(`INSERT OR IGNORE INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`).run("card-4", 2, "rare", 2, "trader2");
}

export interface Card {
  id: string;
  template_id: number;
  rarity: string;
  mint_number: number;
  owner_agent_id: string | null;
  str: number;
  int: number;
  cha: number;
  wis: number;
  dex: number;
  kar: number;
  special_ability: string | null;
  ability_description: string | null;
  agent_name: string;
  class: string;
  element: string;
}

export const PACK_DISTRIBUTION: Record<string, Record<string, number>> = {
  starter: { common: 80, uncommon: 20 },
  standard: { common: 60, uncommon: 25, rare: 15 },
  premium: { uncommon: 40, rare: 40, epic: 20 },
  legendary: { rare: 20, epic: 40, legendary: 30, mythic: 10 },
};

export function calculatePower(card: Card): number {
  const basePower = card.str + card.int + card.cha + card.wis + card.dex + card.kar;
  const rarityMultiplier: Record<string, number> = {
    common: 1.0,
    uncommon: 1.1,
    rare: 1.25,
    epic: 1.5,
    legendary: 2.0,
    mythic: 3.0,
  };
  return Math.floor(basePower * (rarityMultiplier[card.rarity] || 1.0));
}

export function pickRarity(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = total / 2; // Use middle value for deterministic tests
  for (const [rarity, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return rarity;
  }
  return "common";
}