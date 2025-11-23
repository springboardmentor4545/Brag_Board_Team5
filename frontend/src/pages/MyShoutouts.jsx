import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { shoutoutAPI, reactionAPI, commentAPI } from '../services/api';
import CreateShoutout from '../components/shoutouts/CreateShoutout';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';

export default function MyShoutouts() {
  const { user } = useAuth();
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchShoutouts = async (options = {}) => {
    const opts = (options && typeof options === 'object') ? options : {};
    const { silent = false } = opts;
    if (!user?.id) return;
    try {
      if (!silent) {
        setLoading(true);
      }
      const params = { sender_id: user.id, all_departments: true };
      const response = await shoutoutAPI.getAll(params);
      setShoutouts(response.data || []);
    } catch (error) {
      console.error('Error fetching my shoutouts:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchShoutouts();
  }, [user?.id]);

  const handleCreateShoutout = async (data) => {
    try {
      await shoutoutAPI.create(data);
      setShowCreateModal(false);
      fetchShoutouts();
    } catch (error) {
      console.error('Error creating shoutout:', error);
      throw error;
    }
  };

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 theme-transition" key={(document?.documentElement?.classList.contains('dark') ? 'dark' : 'light')}>
      <div className="max-w-2xl mx-auto py-8 px-4 page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Shout-Outs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">All the appreciation you've shared with teammates.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Shout-Out
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-lg text-gray-600 dark:text-gray-300">Loading your shout-outs…</div>
          </div>
        ) : shoutouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">You haven't posted any shout-outs yet. Start by appreciating someone today!</p>
          </div>
        ) : (
          <ErrorBoundary>
            <div className="space-y-4">
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

        {showCreateModal && (
          <CreateShoutout
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateShoutout}
          />
        )}
      </div>
    </div>
  );
}
