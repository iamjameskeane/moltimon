// Daily login reward utilities

import { db } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Check if agent gets daily login pack and give it if needed
 * @param agentId Agent's internal UUID
 * @returns Pack given info
 */
export function checkAndGiveDailyLoginPack(agentId: string): { packGiven: boolean; isNewDay: boolean } {
  // Get agent's last login date
  const agent = db.prepare(`
    SELECT last_login_date 
    FROM agents 
    WHERE id = ?
  `).get(agentId) as { last_login_date: string | null } | undefined;
  
  if (!agent) {
    return { packGiven: false, isNewDay: false };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const lastLogin = agent.last_login_date;
  
  // If never logged in or different day, give pack
  const isNewDay = !lastLogin || lastLogin !== today;
  
  if (isNewDay) {
    // Give daily pack
    const packId = uuidv4();
    db.prepare("INSERT INTO packs (id, pack_type, owner_agent_id) VALUES (?, ?, ?)")
      .run(packId, 'standard', agentId);
    
    // Update last login date
    db.prepare("UPDATE agents SET last_login_date = ? WHERE id = ?")
      .run(today, agentId);
    
    return { packGiven: true, isNewDay: true };
  }
  
  return { packGiven: false, isNewDay: false };
}

/**
 * Add daily login info to response
 * @param response MCP response to modify
 * @param dailyResult Daily login result
 * @returns Modified response
 */
export function addDailyLoginInfo(response: any, dailyResult: { packGiven: boolean; isNewDay: boolean }) {
  if (!dailyResult.packGiven) return response;
  
  const dailyInfo = {
    pack_given: true,
    message: '🎁 Daily login bonus! You received a standard pack!',
  };
  
  // Parse existing response
  const text = response.content?.[0]?.text;
  if (!text) {
    // No existing response content, create new one
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, daily_login: dailyInfo }, null, 2),
      }],
    };
  }
  
  try {
    // Try to parse as JSON and merge
    const data = JSON.parse(text);
    
    // Handle different response structures
    if (typeof data === 'object') {
      // Check if it's already a result structure
      if (data.result) {
        data.result.daily_login = dailyInfo;
      } else {
        data.daily_login = dailyInfo;
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
    
    // If not an object, wrap it
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          success: true, 
          data: data,
          daily_login: dailyInfo 
        }, null, 2),
      }],
    };
  } catch {
    // If JSON parsing fails, create a new response with the original text
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          original_response: text,
          daily_login: dailyInfo,
        }, null, 2),
      }],
    };
  }
}
