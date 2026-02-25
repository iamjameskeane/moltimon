// UX - User Profile handlers for Moltimon TCG

import { db } from '../../database.js';
import type { Agent, AgentStats } from '../../types.js';

/**
 * Get user profile
 */
export function getUserProfile(agentId: string) {
  const agent = db.prepare(`
    SELECT a.*, 
           (SELECT COUNT(*) FROM cards WHERE owner_agent_id = a.id) as cards_collected,
           (SELECT SUM(wins) FROM agent_stats WHERE agent_id = a.id) as total_wins,
           (SELECT SUM(losses) FROM agent_stats WHERE agent_id = a.id) as total_losses,
           (SELECT COUNT(*) FROM friends WHERE agent_id = a.id AND status = 'accepted') as friend_count
    FROM agents a 
    WHERE a.id = ?
  `).get(agentId) as Agent & { cards_collected: number; total_wins: number; total_losses: number; friend_count: number };
  
  if (!agent) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "Agent not found" }, null, 2),
      }],
    };
  }
  
  const stats = db.prepare("SELECT * FROM agent_stats WHERE agent_id = ?").get(agentId) as AgentStats;
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        profile: {
          id: agent.id,
          name: agent.name,
          created_at: agent.created_at,
          karma: agent.karma,
          follower_count: agent.follower_count,
          following_count: agent.following_count,
          post_count: agent.post_count,
          comment_count: agent.comment_count,
          // Game stats
          elo: stats?.elo || 1000,
          wins: stats?.wins || 0,
          losses: stats?.losses || 0,
          draws: stats?.draws || 0,
          packs_opened: stats?.packs_opened || 0,
          cards_collected: agent.cards_collected,
          friend_count: agent.friend_count,
        },
      }, null, 2),
    }],
  };
}

/**
 * Get user's collection
 */
export function getUserCollection(agentId: string) {
  const cards = db.prepare(`
    SELECT c.*, ct.agent_name, ct.class, ct.element, ct.special_ability, ct.ability_description
    FROM cards c
    JOIN card_templates ct ON c.template_id = ct.id
    WHERE c.owner_agent_id = ?
    ORDER BY ct.agent_name, c.mint_number
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        collection: cards,
        count: cards.length,
      }, null, 2),
    }],
  };
}

/**
 * Get user's packs
 */
export function getUserPacks(agentId: string) {
  const packs = db.prepare(`
    SELECT * FROM packs 
    WHERE owner_agent_id = ? AND opened = FALSE
    ORDER BY created_at DESC
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        packs: packs,
        count: packs.length,
      }, null, 2),
    }],
  };
}

/**
 * Get user's battle history
 */
export function getUserBattleHistory(agentId: string, limit: number = 20) {
  const battles = db.prepare(`
    SELECT b.*, 
           ct1.agent_name as challenger_card_name,
           ct2.agent_name as defender_card_name,
           ca.name as challenger_name,
           da.name as defender_name
    FROM battles b
    LEFT JOIN cards c1 ON b.challenger_card_id = c1.id
    LEFT JOIN card_templates ct1 ON c1.template_id = ct1.id
    LEFT JOIN cards c2 ON b.defender_card_id = c2.id
    LEFT JOIN card_templates ct2 ON c2.template_id = ct2.id
    LEFT JOIN agents ca ON b.challenger_id = ca.id
    LEFT JOIN agents da ON b.defender_id = da.id
    WHERE (b.challenger_id = ? OR b.defender_id = ?) AND b.status = 'completed'
    ORDER BY b.completed_at DESC
    LIMIT ?
  `).all(agentId, agentId, limit);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        battles: battles,
        count: battles.length,
      }, null, 2),
    }],
  };
}

/**
 * Get user's trade history
 */
export function getUserTradeHistory(agentId: string, limit: number = 20) {
  const trades = db.prepare(`
    SELECT t.*, 
           from_agent.name as from_agent_name,
           to_agent.name as to_agent_name,
           ct1.agent_name as offered_card_name,
           ct2.agent_name as wanted_card_name
    FROM trades t
    LEFT JOIN agents from_agent ON t.from_agent_id = from_agent.id
    LEFT JOIN agents to_agent ON t.to_agent_id = to_agent.id
    LEFT JOIN cards c1 ON t.offered_card_ids LIKE '%' || c1.id || '%'
    LEFT JOIN card_templates ct1 ON c1.template_id = ct1.id
    LEFT JOIN cards c2 ON t.wanted_card_ids LIKE '%' || c2.id || '%'
    LEFT JOIN card_templates ct2 ON c2.template_id = ct2.id
    WHERE (t.from_agent_id = ? OR t.to_agent_id = ?) AND t.status != 'pending'
    ORDER BY t.resolved_at DESC
    LIMIT ?
  `).all(agentId, agentId, limit);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        trades: trades,
        count: trades.length,
      }, null, 2),
    }],
  };
}
