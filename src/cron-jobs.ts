// Cron job scheduler for Moltimon TCG

import cron from 'node-cron';
import { resetQuests } from './handlers/ux/quests.js';
import { db } from './database.js';

// Daily quest reset - runs at midnight UTC
export function setupDailyQuestReset(): void {
  // Run at 00:00 UTC every day
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily quest reset...');
    try {
      const result = resetQuests('daily');
      const parsed = JSON.parse(result.content[0].text);
      console.log(`Daily quest reset completed: ${parsed.message}`);
    } catch (error) {
      console.error('Error resetting daily quests:', error);
    }
  });
}

// Weekly quest reset - runs at midnight UTC on Sunday
export function setupWeeklyQuestReset(): void {
  // Run at 00:00 UTC every Sunday (0 = Sunday, 1-6 = Monday-Saturday)
  cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly quest reset...');
    try {
      const result = resetQuests('weekly');
      const parsed = JSON.parse(result.content[0].text);
      console.log(`Weekly quest reset completed: ${parsed.message}`);
    } catch (error) {
      console.error('Error resetting weekly quests:', error);
    }
  });
}

// Weekly leaderboard rewards - runs at midnight UTC on Monday
export function setupWeeklyLeaderboardRewards(): void {
  // Run at 00:00 UTC every Monday (1 = Monday)
  cron.schedule('0 0 * * 1', async () => {
    console.log('Running weekly leaderboard rewards...');
    try {
      // Import the handler
      const { handleWeeklyLeaderboardRewards } = await import('./handlers/admin.js');
      const result = handleWeeklyLeaderboardRewards();
      const parsed = JSON.parse(result.content[0].text);
      console.log(`Weekly leaderboard rewards completed: ${parsed.message}`);
    } catch (error) {
      console.error('Error distributing weekly leaderboard rewards:', error);
    }
  });
}

// Achievement check - runs every hour
export function setupAchievementCheck(): void {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly achievement check...');
    try {
      // Get all agents
      const agents = db.prepare("SELECT id FROM agents").all() as Array<{ id: string }>;
      
      // Import the handler
      const { checkAchievements } = await import('./handlers/ux/achievements.js');
      
      let totalUnlocked = 0;
      for (const agent of agents) {
        try {
          const result = checkAchievements(agent.id);
          const parsed = JSON.parse(result.content[0].text);
          totalUnlocked += parsed.count || 0;
        } catch (e) {
          // Skip errors for individual agents
          console.error(`Error checking achievements for agent ${agent.id}:`, e);
        }
      }
      
      if (totalUnlocked > 0) {
        console.log(`Unlocked ${totalUnlocked} achievement(s) in hourly check`);
      }
    } catch (error) {
      console.error('Error in hourly achievement check:', error);
    }
  });
}

// Setup all cron jobs
export function setupAllCronJobs(): void {
  // Don't run cron jobs in test mode
  if (process.env.NODE_ENV === 'test') {
    console.log('Skipping cron job setup in test mode');
    return;
  }
  
  setupDailyQuestReset();
  setupWeeklyQuestReset();
  setupWeeklyLeaderboardRewards();
  setupAchievementCheck();
  
  console.log('Cron jobs scheduled:');
  console.log('- Daily quest reset: 00:00 UTC');
  console.log('- Weekly quest reset: 00:00 UTC Sunday');
  console.log('- Weekly leaderboard rewards: 00:00 UTC Monday');
  console.log('- Hourly achievement check: every hour');
}