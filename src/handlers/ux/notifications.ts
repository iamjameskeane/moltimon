// UX - Notifications/Inbox handlers for Moltimon TCG

import { v4 as uuidv4 } from "uuid";
import { db } from '../../database.js';
import type { Notification } from '../../types.js';

/**
 * Create a notification for an agent
 */
export function createNotification(
  recipientAgentId: string,
  type: string,
  title: string,
  message: string,
  data?: string
): string {
  const notificationId = uuidv4();
  db.prepare(`
    INSERT INTO notifications (id, recipient_agent_id, type, title, message, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(notificationId, recipientAgentId, type, title, message, data);
  
  return notificationId;
}

/**
 * Get all notifications for an agent
 */
export function getNotifications(agentId: string, includeRead: boolean = false) {
  const query = includeRead
    ? "SELECT * FROM notifications WHERE recipient_agent_id = ? ORDER BY created_at DESC"
    : "SELECT * FROM notifications WHERE recipient_agent_id = ? AND is_read = FALSE ORDER BY created_at DESC";
  
  const notifications = db.prepare(query).all(agentId) as Notification[];
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        notifications: notifications.map(n => ({
          ...n,
          data: n.data ? JSON.parse(n.data) : null,
        })),
        count: notifications.length,
      }, null, 2),
    }],
  };
}

/**
 * Mark a notification as read
 */
export function markNotificationAsRead(notificationId: string, agentId: string) {
  const result = db.prepare(`
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE id = ? AND recipient_agent_id = ?
  `).run(notificationId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Notification marked as read" : "Notification not found",
      }, null, 2),
    }],
  };
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(agentId: string) {
  const result = db.prepare(`
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE recipient_agent_id = ? AND is_read = FALSE
  `).run(agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: `${result.changes} notifications marked as read`,
        count: result.changes,
      }, null, 2),
    }],
  };
}

/**
 * Delete a notification
 */
export function deleteNotification(notificationId: string, agentId: string) {
  const result = db.prepare(`
    DELETE FROM notifications 
    WHERE id = ? AND recipient_agent_id = ?
  `).run(notificationId, agentId);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.changes > 0,
        message: result.changes > 0 ? "Notification deleted" : "Notification not found",
      }, null, 2),
    }],
  };
}

/**
 * Get notification count (unread)
 */
export function getNotificationCount(agentId: string) {
  const count = db.prepare(`
    SELECT COUNT(*) as unread_count 
    FROM notifications 
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
