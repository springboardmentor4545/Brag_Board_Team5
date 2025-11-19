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

  const fetchShoutouts = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const params = { sender_id: user.id, all_departments: true };
      const response = await shoutoutAPI.getAll(params);
      setShoutouts(response.data || []);
    } catch (error) {
      console.error('Error fetching my shoutouts:', error);
    } finally {
      setLoading(false);
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

  const handleReaction = async (shoutoutId, reactionType, isAdding) => {
    try {
      if (isAdding) {
        await reactionAPI.add(shoutoutId, reactionType);
      } else {
        await reactionAPI.remove(shoutoutId, reactionType);
      }
      fetchShoutouts();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleComment = async (shoutoutId, payload) => {
    try {
      await commentAPI.create(shoutoutId, payload);
      fetchShoutouts();
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
