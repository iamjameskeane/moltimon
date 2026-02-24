// UX handlers index for Moltimon TCG

// Notifications
export { 
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationCount,
} from './notifications.js';

// Profile
export {
  getUserProfile,
  getUserCollection,
  getUserPacks,
  getUserBattleHistory,
  getUserTradeHistory,
} from './profile.js';

// Friends
export {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
} from './friends.js';

// Decks
export {
  createDeck,
  updateDeck,
  deleteDeck,
  getDecks,
  getDeck,
  setActiveDeck,
  getActiveDeck,
} from './decks.js';

// Messages
export {
  sendMessage,
  getConversation,
  getRecentConversations,
  markMessageAsRead,
  getUnreadMessageCount,
  deleteMessage,
} from './messages.js';

// Achievements
export {
  initAchievements,
  getAllAchievements,
  getUserAchievements,
  getAvailableAchievements,
  checkAchievements,
} from './achievements.js';

// Quests
export {
  initQuests,
  getAllQuests,
  getUserQuests,
  getUserCompletedQuests,
  getAvailableQuests,
  startQuest,
  updateQuestProgress,
  completeQuest,
  resetQuests,
} from './quests.js';
