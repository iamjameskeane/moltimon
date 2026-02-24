// UX - Achievement System handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db } from '../../database.js';
import { createNotification } from './notifications.js';
import type { Achievement, AgentAchievement, AgentStats } from '../../types.js';

// Pre-defined achievements
const ACHIEVEMENTS: Omit<Achievement, 'id' | 'created_at'>[] = [
  {
    name: 'First Battle',
    description: 'Complete your first battle',
    category: 'battle',
    requirement: '{"battles_completed": 1}',
    reward: '{"type": "pack", "pack_type": "standard"}',
  },
  {
    name: 'Battle Master',
    description: 'Win 10 battles',
    category: 'battle',
    requirement: '{"wins": 10}',
    reward: '{"type": "pack", "pack_type": "premium"}',
  },
  {
    name: 'Collector',
    description: 'Collect 50 cards',
    category: 'collection',
    requirement: '{"cards_collected": 50}',
    reward: '{"type": "pack", "pack_type": "legendary"}',
  },
  {
    name: 'Social Butterfly',
    description: 'Make 5 friends',
    category: 'social',
    requirement: '{"friends_made": 5}',
    reward: '{"type": "stat", "stat": "karma", "amount": 100}',
  },
  {
    name: 'Trade Guru',
    description: 'Complete 10 trades',
    category: 'trading',
    requirement: '{"trades_completed": 10}',
    reward: '{"type": "pack", "pack_type": "premium"}',
  },
  {
    name: 'Master Trader',
    description: 'Complete 50 trades',
    category: 'trading',
    requirement: '{"trades_completed": 50}',
    reward: '{"type": "pack", "pack_type": "legendary"}',
  },
];

/**
 * Initialize achievements table (one-time setup)
 */
export function initAchievements() {
  for (const achievement of ACHIEVEMENTS) {
    const existing = db.prepare("SELECT id FROM achievements WHERE name = ?").get(achievement.name);
    if (!existing) {
      const achievementId = uuidv4();
      db.prepare(`
        INSERT INTO achievements (id, name, description, category, requirement, reward)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(achievementId, achievement.name, achievement.description, achievement.category, achievement.requirement, achievement.reward);
    }
  }
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: `Initialized ${ACHIEVEMENTS.length} achievements`,
      }, null, 2),
    }],
  };
}

/**
 * Get all achievements
 */
export function getAllAchievements() {
  const achievements = db.prepare(`
    SELECT * FROM achievements ORDER BY category, name
  `).all();
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        achievements: achievements,
        count: achievements.length,
      }, null, 2),
    }],
  };
}

/**
 * Get user's earned achievements
 */
export function getUserAchievements(agentId: string) {
  const achievements = db.prepare(`
    SELECT a.*, aa.completed_at
    FROM achievements a
    JOIN agent_achievements aa ON a.id = aa.achievement_id
    WHERE aa.agent_id = ?
    ORDER BY aa.completed_at DESC
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        achievements: achievements,
        count: achievements.length,
      }, null, 2),
    }],
  };
}

/**
 * Get available achievements (not yet earned)
 */
export function getAvailableAchievements(agentId: string) {
  const achievements = db.prepare(`
    SELECT * FROM achievements 
    WHERE id NOT IN (
      SELECT achievement_id FROM agent_achievements WHERE agent_id = ?
    )
    ORDER BY category, name
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        achievements: achievements,
        count: achievements.length,
      }, null, 2),
    }],
  };
}

/**
 * Check and award achievements based on current stats
 */
export function checkAchievements(agentId: string) {
  const stats = db.prepare("SELECT * FROM agent_stats WHERE agent_id = ?").get(agentId) as AgentStats | undefined;
  const friends = db.prepare(`
    SELECT COUNT(*) as count FROM friends 
    WHERE agent_id = ? AND status = 'accepted'
  `).get(agentId) as { count: number } | undefined;
  const cards = db.prepare(`
    SELECT COUNT(*) as count FROM cards 
    WHERE owner_agent_id = ?
  `).get(agentId) as { count: number } | undefined;
  
  const earned: string[] = [];
  
  // Check each achievement
  const achievements = db.prepare(`
    SELECT * FROM achievements 
    WHERE id NOT IN (
      SELECT achievement_id FROM agent_achievements WHERE agent_id = ?
    )
  `).all(agentId) as Achievement[];
  
  for (const achievement of achievements) {
    const req = JSON.parse(achievement.requirement);
    let earnedNow = false;
    
    if (req.battles_completed && stats && (stats.wins + stats.losses + stats.draws) >= req.battles_completed) {
      earnedNow = true;
    }
    if (req.wins && stats && stats.wins >= req.wins) {
      earnedNow = true;
    }
    if (req.cards_collected && cards && cards.count >= req.cards_collected) {
      earnedNow = true;
    }
    if (req.friends_made && friends && friends.count >= req.friends_made) {
      earnedNow = true;
    }
    if (req.trades_completed && stats && stats.trades_completed >= req.trades_completed) {
      earnedNow = true;
    }
    
    if (earnedNow) {
      // Award achievement
      const agentAchievementId = uuidv4();
      db.prepare(`
        INSERT INTO agent_achievements (id, agent_id, achievement_id)
        VALUES (?, ?, ?)
      `).run(agentAchievementId, agentId, achievement.id);
      
      earned.push(achievement.name);
      
      // Send notification
      createNotification(
        agentId,
        'achievement',
        'Achievement Unlocked!',
        `You unlocked: ${achievement.name}`,
        JSON.stringify({ achievement: achievement.name, reward: achievement.reward })
      );
      
      // Award reward if applicable
      if (achievement.reward) {
        const reward = JSON.parse(achievement.reward);
        if (reward.type === 'pack' && reward.pack_type) {
          // Award pack (could use createPack from database.ts)
          // For now, just track in data
        } else if (reward.type === 'stat') {
          // Update stat
          db.prepare(`UPDATE agent_stats SET ${reward.stat} = ${reward.stat} + ? WHERE agent_id = ?`)
            .run(reward.amount, agentId);
        }
      }
    }
  }
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        unlocked: earned,
        count: earned.length,
        message: earned.length > 0 ? `Unlocked ${earned.length} achievement(s)` : 'No new achievements',
      }, null, 2),
    }],
  };
}
