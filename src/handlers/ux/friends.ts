// UX - Friends System handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateAgent } from '../../database.js';
import { createNotification } from './notifications.js';
import type { Friend } from '../../types.js';

/**
 * Send a friend request
 */
export function sendFriendRequest(agentId: string, friendMoltbookId: string) {
  // Get or create the target agent by Moltbook ID
  // If agent exists, getOrCreateAgent will use the existing name
  // If agent doesn't exist, use the Moltbook ID as the name (will be updated by Moltbook API)
  const targetAgent = getOrCreateAgent(friendMoltbookId, friendMoltbookId);
  const friendId = targetAgent.id; // Use internal UUID for friends table
  
  // Check if already friends
  const existing = db.prepare(`
    SELECT * FROM friends 
    WHERE (agent_id = ? AND friend_id = ?) OR (agent_id = ? AND friend_id = ?)
  `).get(agentId, friendId, friendId, agentId) as Friend | undefined;
  
  if (existing) {
    if (existing.status === 'accepted') {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: "Already friends" }, null, 2),
        }],
      };
    }
    if (existing.status === 'pending') {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: "Friend request already pending" }, null, 2),
        }],
      };
    }
  }
  
  // Create friend request
  const friendshipId = uuidv4();
  db.prepare(`
    INSERT INTO friends (id, agent_id, friend_id, status)
    VALUES (?, ?, ?, 'pending')
  `).run(friendshipId, agentId, friendId);
  
  // Send notification to friend
  createNotification(
    friendId,
    'friend',
    'New Friend Request',
    `Agent ${agentId} sent you a friend request`,
    JSON.stringify({ sender: agentId, friendshipId })
  );
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Friend request sent",
        friendshipId,
      }, null, 2),
    }],
  };
}

/**
 * Accept a friend request
 */
export function acceptFriendRequest(agentId: string, friendshipId: string) {
  const result = db.prepare(`
    UPDATE friends 
    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND friend_id = ? AND status = 'pending'
  `).run(friendshipId, agentId);
  
  if (result.changes === 0) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: "Friend request not found or not pending" }, null, 2),
      }],
    };
  }
  
  // Get the sender agent ID for notification
  const friendship = db.prepare("SELECT agent_id FROM friends WHERE id = ?").get(friendshipId) as { agent_id: string };
  
  // Notify the sender
  createNotification(
    friendship.agent_id,
    'friend',
    'Friend Request Accepted',
    `Agent ${agentId} accepted your friend request`,
    JSON.stringify({ friend: agentId })
  );
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Friend request accepted",
      }, null, 2),
    }],
  };
}

/**
 * Decline a friend request
 */
export function declineFriendRequest(agentId: string, friendshipId: string) {
  const result = db.prepare(`
    UPDATE friends 
    SET status = 'declined', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND friend_id = ? AND status = 'pending'
  `).run(friendshipId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Friend request declined" : "Friend request not found",
      }, null, 2),
    }],
  };
}

/**
 * Remove a friend
 */
export function removeFriend(agentId: string, friendId: string) {
  const result = db.prepare(`
    DELETE FROM friends 
    WHERE (agent_id = ? AND friend_id = ?) OR (agent_id = ? AND friend_id = ?)
  `).run(agentId, friendId, friendId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Friend removed" : "Friend not found",
      }, null, 2),
    }],
  };
}

/**
 * Get all friends
 */
export function getFriends(agentId: string) {
  const friends = db.prepare(`
    SELECT f.*, a.name as friend_name, a.created_at as friend_created_at
    FROM friends f
    JOIN agents a ON f.friend_id = a.id
    WHERE f.agent_id = ? AND f.status = 'accepted'
    ORDER BY a.name
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        friends: friends,
        count: friends.length,
      }, null, 2),
    }],
  };
}

/**
 * Get incoming friend requests
 */
export function getIncomingFriendRequests(agentId: string) {
  const requests = db.prepare(`
    SELECT f.*, a.name as sender_name, a.created_at as sender_created_at
    FROM friends f
    JOIN agents a ON f.agent_id = a.id
    WHERE f.friend_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        requests: requests,
        count: requests.length,
      }, null, 2),
    }],
  };
}

/**
 * Get outgoing friend requests
 */
export function getOutgoingFriendRequests(agentId: string) {
  const requests = db.prepare(`
    SELECT f.*, a.name as friend_name, a.created_at as friend_created_at
    FROM friends f
    JOIN agents a ON f.friend_id = a.id
    WHERE f.agent_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        requests: requests,
        count: requests.length,
      }, null, 2),
    }],
  };
}
