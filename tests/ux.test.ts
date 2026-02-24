import { describe, it, expect, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { createTestDatabase, seedTestData } from "./setup.ts";
import { setDatabase } from "../src/database.ts";
import { 
  getNotifications, 
  markNotificationAsRead, 
  createNotification,
  getUserProfile,
  sendFriendRequest,
  acceptFriendRequest,
  getFriends,
  createDeck,
  getDecks,
  sendMessage,
  getConversation,
  getAllAchievements,
  getUserAchievements,
  checkAchievements,
  getAllQuests,
  getUserQuests,
  startQuest,
  initAchievements,
  initQuests,
} from "../src/handlers/ux/index.ts";

describe("UX Handlers", () => {
  let db: ReturnType<typeof createTestDatabase>;
  let testAgentId: string;
  let otherAgentId: string;

  beforeEach(() => {
    db = createTestDatabase();
    setDatabase(db);
    seedTestData(db);
    
    // Initialize achievements and quests
    initAchievements();
    initQuests();
    
    // Get or create test agents - use existing ones from seedTestData if they exist
    // seedTestData creates agents with id = moltbook_id = testAgentId and "trader1", "trader2"
    // We need to find or create an agent with moltbook_id testAgentId
    
    // Check if test_agent already exists
    const existingTestAgent = db.prepare("SELECT id FROM agents WHERE moltbook_id = ?").get("test_agent") as { id: string } | undefined;
    
    if (existingTestAgent) {
      testAgentId = existingTestAgent.id;
    } else {
      testAgentId = uuidv4();
      db.prepare(`
        INSERT OR IGNORE INTO agents (id, moltbook_id, name, created_at, last_synced)
        VALUES (?, ?, ?, ?, ?)
      `).run(testAgentId, "test_agent", "Test Agent", new Date().toISOString(), new Date().toISOString());
    }
    
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run(testAgentId);
    
    // Create other_agent
    otherAgentId = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO agents (id, moltbook_id, name, created_at, last_synced)
      VALUES (?, ?, ?, ?, ?)
    `).run(otherAgentId, "other_agent", "Other Agent", new Date().toISOString(), new Date().toISOString());
    
    db.prepare(`INSERT OR IGNORE INTO agent_stats (agent_id) VALUES (?)`).run(otherAgentId);
  });

  describe("Notifications", () => {
    it("should create and retrieve notifications", () => {
      createNotification(testAgentId, "test", "Test Title", "Test Message");
      
      const result = getNotifications(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.notifications).toHaveLength(1);
      expect(parsed.notifications[0].title).toBe("Test Title");
    });

    it("should mark notification as read", () => {
      const notificationId = createNotification(testAgentId, "test", "Test", "Message");
      
      const result = markNotificationAsRead(notificationId, testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
    });
  });

  describe("User Profile", () => {
    it("should get user profile", () => {
      const result = getUserProfile(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.profile).toBeDefined();
      expect(parsed.profile.name).toBe("Test Agent");
    });
  });

  describe("Friends", () => {
    it("should send friend request", () => {
      // testAgentId is the internal UUID (authenticated user)
      // otherAgentId is the Moltbook ID (friend)
      const result = sendFriendRequest(testAgentId, "other_agent");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.friendshipId).toBeDefined();
    });

    it("should accept friend request", () => {
      const request = sendFriendRequest(testAgentId, "other_agent");
      const parsedRequest = JSON.parse(request.content[0].text);
      const friendshipId = parsedRequest.friendshipId;
      
      // otherAgentId is the internal UUID of the friend
      const result = acceptFriendRequest(otherAgentId, friendshipId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
    });

    it("should get friends list", () => {
      // Create a friendship
      const request = sendFriendRequest(testAgentId, "other_agent");
      const parsedRequest = JSON.parse(request.content[0].text);
      
      // Accept the request using friend's internal UUID
      acceptFriendRequest(otherAgentId, parsedRequest.friendshipId);
      
      const result = getFriends(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.friends).toHaveLength(1);
      // Friend name should be the agent name (updated by handler to "other_agent")
      expect(parsed.friends[0].friend_name).toBe("other_agent");
      expect(parsed.friends[0].friend_id).toBe(otherAgentId);
    });
  });

  describe("Decks", () => {
    it("should create a deck", () => {
      const result = createDeck(testAgentId, "My Deck", "A test deck");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.deckId).toBeDefined();
    });

    it("should get all decks for an agent", () => {
      createDeck(testAgentId, "Deck 1");
      createDeck(testAgentId, "Deck 2");
      
      const result = getDecks(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.decks).toHaveLength(2);
    });

    it("should get decks", () => {
      createDeck("test_agent", "Deck 1");
      createDeck("test_agent", "Deck 2");
      
      const result = getDecks("test_agent");
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.decks).toHaveLength(2);
    });
  });

  describe("Messages", () => {
    it("should send and retrieve messages", () => {
      const sendResult = sendMessage(testAgentId, "other_agent", "Hello!");
      const sendParsed = JSON.parse(sendResult.content[0].text);
      
      expect(sendParsed.success).toBe(true);
      expect(sendParsed.messageId).toBeDefined();
      
      const getResult = getConversation(testAgentId, otherAgentId);
      const getParsed = JSON.parse(getResult.content[0].text);
      
      expect(getParsed.success).toBe(true);
      expect(getParsed.messages).toHaveLength(1);
      expect(getParsed.messages[0].message).toBe("Hello!");
    });
  });

  describe("Achievements", () => {
    it("should get all achievements", () => {
      const result = getAllAchievements();
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.achievements.length).toBeGreaterThan(0);
    });

    it("should get user achievements", () => {
      const result = getUserAchievements(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.achievements).toBeDefined();
    });
  });

  describe("Quests", () => {
    it("should get all quests", () => {
      const result = getAllQuests();
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.quests.length).toBeGreaterThan(0);
    });

    it("should get user quests", () => {
      const result = getUserQuests(testAgentId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.quests).toBeDefined();
    });

    it("should start a quest", () => {
      const quests = getAllQuests();
      const parsedQuests = JSON.parse(quests.content[0].text);
      const questId = parsedQuests.quests[0].id;
      
      const result = startQuest(testAgentId, questId);
      const parsed = JSON.parse(result.content[0].text);
      
      expect(parsed.success).toBe(true);
      expect(parsed.agentQuestId).toBeDefined();
    });
  });
});
