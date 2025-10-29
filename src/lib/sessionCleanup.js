/**
 * Session Cleanup Utility
 *
 * Provides scheduled cleanup of expired sessions
 * Runs periodically to keep the database clean
 *
 * @module sessionCleanup
 */

import Session from '../models/Session.js';

/**
 * Clean up expired sessions
 * Marks expired sessions as inactive
 *
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupExpiredSessions = async () => {
  try {
    console.log('🧹 Starting session cleanup...');
    const result = await Session.cleanupExpired();
    return result;
  } catch (error) {
    console.error('Session cleanup error:', error);
    throw error;
  }
};

/**
 * Delete old inactive sessions
 * Permanently removes sessions that have been inactive for a specified period
 *
 * @param {number} daysOld - Delete sessions older than this many days (default: 30)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteOldSessions = async (daysOld = 30) => {
  try {
    console.log(`🗑️  Deleting inactive sessions older than ${daysOld} days...`);
    const result = await Session.deleteOldSessions(daysOld);
    return result;
  } catch (error) {
    console.error('Delete old sessions error:', error);
    throw error;
  }
};

/**
 * Start periodic session cleanup
 * Runs cleanup tasks at specified intervals
 *
 * @param {number} intervalMinutes - Minutes between cleanup runs (default: 60)
 * @returns {NodeJS.Timeout} Interval reference
 */
export const startSessionCleanup = (intervalMinutes = 60) => {
  console.log(`⏰ Session cleanup scheduled every ${intervalMinutes} minutes`);

  // Run cleanup immediately on start
  cleanupExpiredSessions().catch(console.error);

  // Schedule periodic cleanup
  const interval = setInterval(() => {
    cleanupExpiredSessions().catch(console.error);
  }, intervalMinutes * 60 * 1000);

  // Schedule daily old session deletion (runs at midnight)
  scheduleDaily(() => {
    deleteOldSessions(30).catch(console.error);
  });

  return interval;
};

/**
 * Schedule a task to run daily
 *
 * @param {Function} task - Task to run
 */
function scheduleDaily(task) {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0, // Midnight
  );
  const msUntilMidnight = midnight.getTime() - now.getTime();

  // Run at midnight, then every 24 hours
  setTimeout(() => {
    task();
    setInterval(task, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntilMidnight);
}

export default {
  cleanupExpiredSessions,
  deleteOldSessions,
  startSessionCleanup,
};
