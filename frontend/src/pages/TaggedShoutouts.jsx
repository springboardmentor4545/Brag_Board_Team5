import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { shoutoutAPI, reactionAPI, commentAPI } from '../services/api';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../App.css';

export default function TaggedShoutouts() {
  const { user } = useAuth();
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const fetchShoutouts = useCallback(async (options = {}) => {
    const opts = (options && typeof options === 'object') ? options : {};
    const { silent = false } = opts;
    if (!user?.id) return;
    try {
      if (!silent) {
        setLoading(true);
      }
      const params = { recipient_id: user.id, all_departments: true };
      const response = await shoutoutAPI.getAll(params);
      setShoutouts(response.data || []);
    } catch (error) {
      console.error('Error fetching shout-outs for me:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(() => setIsMounted(true), 16);
    return () => clearTimeout(timeout);
  }, []);

  const handleReaction = async (shoutoutId, reactionType, isAdding, replacedTypes = []) => {
    const previousState = shoutouts.map((item) => ({
      ...item,
      reaction_counts: item.reaction_counts ? { ...item.reaction_counts } : undefined,
      user_reactions: Array.isArray(item.user_reactions) ? [...item.user_reactions] : undefined,
    }));

    const replacements = Array.isArray(replacedTypes)
      ? [...new Set(replacedTypes.filter((value) => value && value !== reactionType))]
      : [];

    setShoutouts((current) => current.map((item) => {
      if (item.id !== shoutoutId) {
        return item;
      }

      const currentCounts = { ...(item.reaction_counts || {}) };
      const currentUserReactions = new Set(item.user_reactions || []);

      if (isAdding) {
        replacements.forEach((oldType) => {
          if (currentUserReactions.delete(oldType)) {
            currentCounts[oldType] = Math.max((currentCounts[oldType] || 1) - 1, 0);
          }
        });
        currentUserReactions.add(reactionType);
        currentCounts[reactionType] = (currentCounts[reactionType] || 0) + 1;
      } else {
        currentUserReactions.delete(reactionType);
        currentCounts[reactionType] = Math.max((currentCounts[reactionType] || 1) - 1, 0);
      }

      return {
        ...item,
        reaction_counts: currentCounts,
        user_reactions: Array.from(currentUserReactions),
      };
    }));

    try {
      if (isAdding) {
        for (const oldType of replacements) {
          await reactionAPI.remove(shoutoutId, oldType);
        }
        await reactionAPI.add(shoutoutId, reactionType);
      } else {
        await reactionAPI.remove(shoutoutId, reactionType);
      }
      fetchShoutouts({ silent: true });
    } catch (error) {
      console.error('Error handling reaction:', error);
      setShoutouts(previousState);
    }
  };

  const handleComment = async (shoutoutId, payload) => {
    try {
      const response = await commentAPI.create(shoutoutId, payload);
      const createdComment = response?.data;
      setShoutouts((current) => current.map((item) => (
        item.id === shoutoutId
          ? { ...item, comment_count: (item.comment_count ?? 0) + 1 }
          : item
      )));
      fetchShoutouts({ silent: true });
      return createdComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-gray-950 theme-transition feed-page tagged-page ${isMounted ? 'is-mounted' : ''}`}
      key={(document?.documentElement?.classList.contains('dark') ? 'dark' : 'light')}
    >
      <div className="max-w-2xl mx-auto py-8 px-4 page-container feed-shell">
        <div className="mb-6 tagged-header">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Shout-Outs For Me</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Every shout-out where teammates tagged you.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 tagged-state">
            <div className="text-lg text-gray-600 dark:text-gray-300">Loading shout-outs…</div>
          </div>
        ) : shoutouts.length === 0 ? (
          <div className="text-center py-12 tagged-state">
            <p className="text-gray-500 dark:text-gray-400">No shout-outs yet. Keep doing great work!</p>
          </div>
        ) : (
          <ErrorBoundary>
            <div className="space-y-4 feed-list tagged-list">
              {shoutouts.map((shoutout) => (
                <ShoutoutCard
                  key={shoutout.id}
                  shoutout={shoutout}
                  onReaction={handleReaction}
                  onComment={handleComment}
                  onRefresh={fetchShoutouts}
                />
              ))}
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
