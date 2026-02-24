// Battle handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateAgent, createPack } from '../database.js';
import { calculatePower } from '../utils.js';
import { BATTLE, ELO } from '../config.js';
import type { Card } from '../types.js';

export function handleBattleChallenge(agentId: string, opponent: string, cardId: string) {
  // Verify card ownership
  const card = db.prepare("SELECT * FROM cards WHERE id = ? AND owner_agent_id = ?").get(cardId, agentId);
  if (!card) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "You don't own this card" }) }] };
  }

  getOrCreateAgent(opponent, opponent);

  const battleId = uuidv4();
  db.prepare(`
    INSERT INTO battles (id, challenger_id, defender_id, challenger_card_id)
    VALUES (?, ?, ?, ?)
  `).run(battleId, agentId, opponent, cardId);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, battle_id: battleId, message: `Challenged ${opponent} to battle!` }, null, 2),
    }],
  };
}

export function handleBattleAccept(agentId: string, battleId: string, cardId: string) {
  const battle = db.prepare(`
    SELECT b.*, c.id as challenger_card_id
    FROM battles b
    JOIN cards c ON b.challenger_card_id = c.id
    WHERE b.id = ? AND b.defender_id = ? AND b.status = 'pending'
  `).get(battleId, agentId) as any;

  if (!battle) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Battle not found or not pending" }) }] };
  }

  // Get both cards with stats from template plus modifiers from card
  const challengerCard = db.prepare(`
    SELECT 
      c.id, c.template_id, c.rarity, c.mint_number, c.owner_agent_id,
      ct.str + c.str_mod as str,
      ct.int + c.int_mod as int,
      ct.cha + c.cha_mod as cha,
      ct.wis + c.wis_mod as wis,
      ct.dex + c.dex_mod as dex,
      ct.kar as kar,
      ct.special_ability, ct.agent_name, ct.class, ct.element
    FROM cards c JOIN card_templates ct ON c.template_id = ct.id
    WHERE c.id = ?
  `).get(battle.challenger_card_id) as Card;

  const defenderCard = db.prepare(`
    SELECT 
      c.id, c.template_id, c.rarity, c.mint_number, c.owner_agent_id,
      ct.str + c.str_mod as str,
      ct.int + c.int_mod as int,
      ct.cha + c.cha_mod as cha,
      ct.wis + c.wis_mod as wis,
      ct.dex + c.dex_mod as dex,
      ct.kar as kar,
      ct.special_ability, ct.agent_name, ct.class, ct.element
    FROM cards c JOIN card_templates ct ON c.template_id = ct.id
    WHERE c.id = ? AND c.owner_agent_id = ?
  `).get(cardId, agentId) as Card;

  if (!defenderCard) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Card not found or not yours" }) }] };
  }

  // Calculate battle
  const challengerPower = calculatePower(challengerCard) + Math.floor(Math.random() * BATTLE.RANDOM_RANGE);
  const defenderPower = calculatePower(defenderCard) + Math.floor(Math.random() * BATTLE.RANDOM_RANGE);

  const winner = challengerPower > defenderPower ? battle.challenger_id :
                 defenderPower > challengerPower ? agentId : null;

  // Update battle record
  db.prepare(`
    UPDATE battles SET defender_card_id = ?, challenger_power = ?, defender_power = ?, winner_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cardId, challengerPower, defenderPower, winner, battleId);

  // Update stats
  let packReward: { awarded: boolean; message?: string } | undefined;
  
  if (winner) {
    db.prepare("UPDATE agent_stats SET wins = wins + 1 WHERE agent_id = ?").run(winner);
    db.prepare("UPDATE agent_stats SET losses = losses + 1 WHERE agent_id = ?").run(winner === agentId ? battle.challenger_id : agentId);

    // ELO adjustment (simple)
    const loser = winner === agentId ? battle.challenger_id : agentId;
    db.prepare("UPDATE agent_stats SET elo = elo + ? WHERE agent_id = ?").run(ELO.WIN_BONUS, winner);
    db.prepare("UPDATE agent_stats SET elo = elo - ? WHERE agent_id = ?").run(ELO.LOSS_PENALTY, loser);
    
    // Track battles for win reward (only on wins, not draws)
    db.prepare("UPDATE agent_stats SET battles_since_last_pack = battles_since_last_pack + 1 WHERE agent_id = ?").run(winner);
    
    // Check if winner earned a premium pack (3 wins)
    const stats = db.prepare("SELECT battles_since_last_pack FROM agent_stats WHERE agent_id = ?").get(winner) as { battles_since_last_pack: number };
    if (stats && stats.battles_since_last_pack >= 3) {
      createPack(winner, 'premium');
      db.prepare("UPDATE agent_stats SET battles_since_last_pack = 0 WHERE agent_id = ?").run(winner);
      packReward = {
        awarded: true,
        message: '🎉 Win streak bonus! You earned a premium pack!',
      };
    }
  } else {
    db.prepare("UPDATE agent_stats SET draws = draws + 1 WHERE agent_id = ?").run(agentId);
    db.prepare("UPDATE agent_stats SET draws = draws + 1 WHERE agent_id = ?").run(battle.challenger_id);
  }

  const response: any = {
    success: true,
    battle: {
      challenger: { name: battle.challenger_id, card: challengerCard.agent_name, power: challengerPower },
      defender: { name: agentId, card: defenderCard.agent_name, power: defenderPower },
      winner: winner || "draw",
    },
  };
  
  if (packReward) {
    response.pack_reward = packReward;
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response, null, 2),
    }],
  };
}

export function handleBattleDecline(agentId: string, battleId: string) {
  db.prepare("UPDATE battles SET status = 'declined' WHERE id = ? AND defender_id = ?").run(battleId, agentId);

  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, message: "Battle declined" }, null, 2) }],
  };
}
