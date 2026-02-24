import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase, seedTestData } from "./setup.ts";
import { handleGetCollection, handleGetCard } from "../src/handlers/collection.ts";

describe("Collection Handlers", () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData(db);
  });

  describe("handleGetCollection", () => {
    it("should return empty collection for new agent", () => {
      const result = handleGetCollection("new_agent", "New Agent");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.collection).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it("should return cards in collection", () => {
      // Insert cards for agent with unique IDs
      db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
        .run("test-collection-card-1", 1, "common", 1, "test_agent");
      db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
        .run("test-collection-card-2", 2, "rare", 1, "test_agent");

      const result = handleGetCollection("test_agent", "Test Agent");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.collection).toHaveLength(2);
      expect(parsed.count).toBe(2);
    });

    it("should include power calculation in response", () => {
      db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
        .run("test-collection-card-3", 1, "common", 1, "test_agent");

      const result = handleGetCollection("test_agent", "Test Agent");
      const parsed = JSON.parse(result.content[0].text);
      
      // Check that collection has items and total_power is present
      expect(parsed.collection).toBeDefined();
      expect(parsed.collection.length).toBeGreaterThan(0);
      expect(parsed.collection[0].total_power).toBeDefined();
    });
  });

  describe("handleGetCard", () => {
    it("should return card details", () => {
      db.prepare(`INSERT INTO cards (id, template_id, rarity, mint_number, owner_agent_id) VALUES (?, ?, ?, ?, ?)`)
        .run("test-card-details-1", 1, "rare", 1, "test_agent");

      const result = handleGetCard("test-card-details-1");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.card).toBeDefined();
      expect(parsed.card.rarity).toBe("rare");
      expect(parsed.card.total_power).toBeDefined();
    });

    it("should return error for non-existent card", () => {
      const result = handleGetCard("non-existent");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("not found");
    });
  });
});