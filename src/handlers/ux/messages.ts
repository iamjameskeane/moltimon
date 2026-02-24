// UX - Messaging System handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateAgent } from '../../database.js';
import { createNotification } from './notifications.js';
import type { Message } from '../../types.js';

/**
 * Send a message to another agent
 */
export function sendMessage(senderId: string, recipientMoltbookId: string, message: string) {
  // Get or create recipient by Moltbook ID
  const recipientAgent = getOrCreateAgent(recipientMoltbookId, recipientMoltbookId);
  const recipientId = recipientAgent.id; // Use internal UUID for messages table
  
  // Check if friends (optional restriction)
  const friendship = db.prepare(`
    SELECT status FROM friends 
    WHERE (agent_id = ? AND friend_id = ?) OR (agent_id = ? AND friend_id = ?)
    AND status = 'accepted'
  `).get(senderId, recipientId, recipientId, senderId);
  
  if (!friendship) {
    // For now, allow messaging between non-friends too
    // Could add this restriction later
  }
  
  const messageId = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, sender_agent_id, recipient_agent_id, message)
    VALUES (?, ?, ?, ?)
  `).run(messageId, senderId, recipientId, message);
  
  // Send notification to recipient
  createNotification(
    recipientId,
    'message',
    'New Message',
    `You have a new message from ${senderId}`,
    JSON.stringify({ sender: senderId, messageId })
  );
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Message sent",
        messageId,
      }, null, 2),
    }],
  };
}

/**
 * Get messages with an agent
 */
export function getConversation(agentId: string, otherAgentId: string, limit: number = 50) {
  const messages = db.prepare(`
    SELECT m.*, 
           CASE WHEN m.sender_agent_id = ? THEN 'sent' ELSE 'received' END as direction
    FROM messages m
    WHERE (m.sender_agent_id = ? AND m.recipient_agent_id = ?)
       OR (m.sender_agent_id = ? AND m.recipient_agent_id = ?)
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(agentId, agentId, otherAgentId, otherAgentId, agentId, limit) as Message[];
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        messages: messages.reverse(), // Show in chronological order
        count: messages.length,
      }, null, 2),
    }],
  };
}

/**
 * Get all recent conversations
 */
export function getRecentConversations(agentId: string, limit: number = 10) {
  const conversations = db.prepare(`
    SELECT DISTINCT
      CASE WHEN m.sender_agent_id = ? THEN m.recipient_agent_id ELSE m.sender_agent_id END as other_agent_id,
      MAX(m.created_at) as last_message_at,
      COUNT(*) as message_count,
      MAX(m.message) as last_message,
      MAX(a.name) as other_agent_name
    FROM messages m
    LEFT JOIN agents a ON 
      CASE WHEN m.sender_agent_id = ? THEN m.recipient_agent_id ELSE m.sender_agent_id END = a.id
    WHERE m.sender_agent_id = ? OR m.recipient_agent_id = ?
    GROUP BY other_agent_id
    ORDER BY last_message_at DESC
    LIMIT ?
  `).all(agentId, agentId, agentId, agentId, limit);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        conversations: conversations,
        count: conversations.length,
      }, null, 2),
    }],
  };
}

/**
 * Mark message as read
 */
export function markMessageAsRead(messageId: string, agentId: string) {
  const result = db.prepare(`
    UPDATE messages 
    SET is_read = TRUE 
    WHERE id = ? AND recipient_agent_id = ? AND is_read = FALSE
  `).run(messageId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Message marked as read" : "Message not found or already read",
      }, null, 2),
    }],
  };
}

/**
 * Get unread message count
 */
export function getUnreadMessageCount(agentId: string) {
  const count = db.prepare(`
    SELECT COUNT(*) as unread_count 
    FROM messages 
    WHERE recipient_agent_id = ? AND is_read = FALSE
  `).get(agentId) as { unread_count: number };
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        unread_count: count.unread_count,
      }, null, 2),
    }],
  };
}

/**
 * Delete a message
 */
export function deleteMessage(messageId: string, agentId: string) {
  const result = db.prepare(`
    DELETE FROM messages 
    WHERE id = ? AND sender_agent_id = ?
  `).run(messageId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Message deleted" : "Message not found or not yours",
      }, null, 2),
    }],
  };
}
