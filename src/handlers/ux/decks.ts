// UX - Deck Building handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db } from '../../database.js';
import type { Deck } from '../../types.js';

/**
 * Create a new deck
 */
export function createDeck(agentId: string, name: string, description?: string) {
  // Check deck count limit
  const existingCount = db.prepare(`
    SELECT COUNT(*) as count FROM decks WHERE agent_id = ?
  `).get(agentId) as { count: number };
  
  if (existingCount.count >= 10) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "Maximum 10 decks allowed" }, null, 2),
      }],
    };
  }
  
  const deckId = uuidv4();
  db.prepare(`
    INSERT INTO decks (id, agent_id, name, description, card_ids)
    VALUES (?, ?, ?, ?, '[]')
  `).run(deckId, agentId, name, description || '');
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Deck created",
        deckId,
      }, null, 2),
    }],
  };
}

/**
 * Update a deck (add/remove cards)
 */
export function updateDeck(agentId: string, deckId: string, cardIds: string[]) {
  const deck = db.prepare("SELECT * FROM decks WHERE id = ? AND agent_id = ?").get(deckId, agentId) as Deck | undefined;
  
  if (!deck) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "Deck not found" }, null, 2),
      }],
    };
  }
  
  // Verify all cards belong to the agent
  for (const cardId of cardIds) {
    const card = db.prepare("SELECT * FROM cards WHERE id = ? AND owner_agent_id = ?").get(cardId, agentId);
    if (!card) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: `Card ${cardId} not found in your collection` }, null, 2),
        }],
      };
    }
  }
  
  db.prepare(`
    UPDATE decks 
    SET card_ids = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND agent_id = ?
  `).run(JSON.stringify(cardIds), deckId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Deck updated",
        card_count: cardIds.length,
      }, null, 2),
    }],
  };
}

/**
 * Delete a deck
 */
export function deleteDeck(agentId: string, deckId: string) {
  const result = db.prepare(`
    DELETE FROM decks 
    WHERE id = ? AND agent_id = ?
  `).run(deckId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Deck deleted" : "Deck not found",
      }, null, 2),
    }],
  };
}

/**
 * Get all decks for agent
 */
export function getDecks(agentId: string) {
  const decks = db.prepare(`
    SELECT d.*, 
           (SELECT COUNT(*) FROM json_each(d.card_ids)) as card_count
    FROM decks d
    WHERE d.agent_id = ?
    ORDER BY d.created_at DESC
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        decks: decks,
        count: decks.length,
      }, null, 2),
    }],
  };
}

/**
 * Get a specific deck
 */
export function getDeck(agentId: string, deckId: string) {
  const deck = db.prepare(`
    SELECT d.*, 
           (SELECT GROUP_CONCAT(c.id) FROM cards c 
            WHERE c.id IN (SELECT value FROM json_each(d.card_ids))) as card_ids_list
    FROM decks d
    WHERE d.id = ? AND d.agent_id = ?
  `).get(deckId, agentId) as Deck & { card_ids_list?: string };
  
  if (!deck) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "Deck not found" }, null, 2),
      }],
    };
  }
  
  // Get card details
  const cardIds = deck.card_ids_list ? deck.card_ids_list.split(',') : [];
  const cards = cardIds.length > 0 
    ? db.prepare(`
        SELECT c.*, ct.agent_name, ct.class, ct.element
        FROM cards c
        JOIN card_templates ct ON c.template_id = ct.id
        WHERE c.id IN (${cardIds.map(() => '?').join(',')})
      `).all(...cardIds)
    : [];
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        deck: {
          ...deck,
          card_ids: JSON.parse(deck.card_ids),
          cards,
        },
      }, null, 2),
    }],
  };
}

/**
 * Set active deck
 */
export function setActiveDeck(agentId: string, deckId: string) {
  // First, mark all decks as inactive
  db.prepare("UPDATE decks SET is_active = FALSE WHERE agent_id = ?").run(agentId);
  
  // Set the specified deck as active
  const result = db.prepare(`
    UPDATE decks 
    SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND agent_id = ?
  `).run(deckId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Active deck set" : "Deck not found",
      }, null, 2),
    }],
  };
}

/**
 * Get active deck
 */
export function getActiveDeck(agentId: string) {
  const deck = db.prepare(`
    SELECT d.*, 
           (SELECT GROUP_CONCAT(c.id) FROM cards c 
            WHERE c.id IN (SELECT value FROM json_each(d.card_ids))) as card_ids_list
    FROM decks d
    WHERE d.agent_id = ? AND d.is_active = TRUE
  `).get(agentId) as Deck & { card_ids_list?: string };
  
  if (!deck) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "No active deck set" }, null, 2),
      }],
    };
  }
  
  // Get card details
  const cardIds = deck.card_ids_list ? deck.card_ids_list.split(',') : [];
  const cards = cardIds.length > 0 
    ? db.prepare(`
        SELECT c.*, ct.agent_name, ct.class, ct.element
        FROM cards c
        JOIN card_templates ct ON c.template_id = ct.id
        WHERE c.id IN (${cardIds.map(() => '?').join(',')})
      `).all(...cardIds)
    : [];
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        deck: {
          ...deck,
          card_ids: JSON.parse(deck.card_ids),
          cards,
        },
      }, null, 2),
    }],
  };
}
