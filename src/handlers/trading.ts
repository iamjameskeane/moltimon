// Trading handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateAgent } from '../database.js';
import { updateQuestProgress, checkAchievements } from '../handlers/ux/index.js';

export function handleTradeRequest(agentId: string, toAgent: string, offer: string[], want: string[]) {
  // Verify ownership of offered cards
  for (const cardId of offer) {
    const card = db.prepare("SELECT * FROM cards WHERE id = ? AND owner_agent_id = ?").get(cardId, agentId);
    if (!card) {
      return { content: [{ type: "text", text: JSON.stringify({ success: false, error: `You don't own card ${cardId}` }) }] };
    }
  }

  // Verify target agent exists (toAgent is the Moltbook ID)
  // Use toAgent as Moltbook ID and name
  const targetAgent = getOrCreateAgent(toAgent, toAgent);

  const tradeId = uuidv4();
  db.prepare(`
    INSERT INTO trades (id, from_agent_id, to_agent_id, offered_card_ids, wanted_card_ids)
    VALUES (?, ?, ?, ?, ?)
  `).run(tradeId, agentId, targetAgent.id, JSON.stringify(offer), JSON.stringify(want));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, trade_id: tradeId, message: `Trade request sent to ${toAgent}` }, null, 2),
    }],
  };
}

export function handleTradeAccept(agentId: string, tradeId: string) {
  const trade = db.prepare("SELECT * FROM trades WHERE id = ? AND to_agent_id = ? AND status = 'pending'").get(tradeId, agentId) as any;

  if (!trade) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Trade not found or not pending" }) }] };
  }

  const offeredCards = JSON.parse(trade.offered_card_ids);
  const wantedCards = JSON.parse(trade.wanted_card_ids);

  // Swap ownership
  for (const cardId of offeredCards) {
    db.prepare("UPDATE cards SET owner_agent_id = ? WHERE id = ?").run(agentId, cardId);
  }
  for (const cardId of wantedCards) {
    db.prepare("UPDATE cards SET owner_agent_id = ? WHERE id = ?").run(trade.from_agent_id, cardId);
  }

  db.prepare("UPDATE trades SET status = 'accepted', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(tradeId);
  db.prepare("UPDATE agent_stats SET trades_completed = trades_completed + 1 WHERE agent_id = ?").run(agentId);
  db.prepare("UPDATE agent_stats SET trades_completed = trades_completed + 1 WHERE agent_id = ?").run(trade.from_agent_id);
  
  // Update cards_collected stat (count new cards acquired)
  db.prepare("UPDATE agent_stats SET cards_collected = cards_collected + ? WHERE agent_id = ?").run(wantedCards.length, agentId);
  db.prepare("UPDATE agent_stats SET cards_collected = cards_collected + ? WHERE agent_id = ?").run(offeredCards.length, trade.from_agent_id);
  
  // Update quest progress for trade-related quests
  try {
    // Get quest IDs by name
    const dailyTradingQuest = db.prepare("SELECT id FROM quests WHERE name = ?").get('Daily Trading') as { id: string } | undefined;
    
    // Update quest progress for both agents (trades_needed)
    if (dailyTradingQuest) {
      updateQuestProgress(agentId, dailyTradingQuest.id, 1);
      updateQuestProgress(trade.from_agent_id, dailyTradingQuest.id, 1);
    }
    
    // Check achievements for both agents
    checkAchievements(agentId);
    checkAchievements(trade.from_agent_id);
  } catch (e) {
    // Quest/achievement updates are non-critical, don't fail the trade
    console.error('Error updating quest/achievement progress:', e);
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, message: "Trade completed!" }, null, 2),
    }],
  };
}

export function handleTradeDecline(agentId: string, tradeId: string) {
  db.prepare("UPDATE trades SET status = 'declined', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND to_agent_id = ?").run(tradeId, agentId);

  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, message: "Trade declined" }, null, 2) }],
  };
}
