import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { shoutoutAPI, reactionAPI, commentAPI } from '../services/api';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';

export default function TaggedShoutouts() {
  const { user } = useAuth();
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchShoutouts = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const params = { recipient_id: user.id, all_departments: true };
      const response = await shoutoutAPI.getAll(params);
      setShoutouts(response.data || []);
    } catch (error) {
      console.error('Error fetching shout-outs for me:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShoutouts();
  }, [user?.id]);

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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Shout-Outs For Me</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Every shout-out where teammates tagged you.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-lg text-gray-600 dark:text-gray-300">Loading shout-outs…</div>
          </div>
        ) : shoutouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No shout-outs yet. Keep doing great work!</p>
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
      </div>
    </div>
  );
}
