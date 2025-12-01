import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shoutoutAPI, commentAPI, reactionAPI, userAPI } from '../services/api';
import CreateShoutout from '../components/shoutouts/CreateShoutout';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../App.css';

const parseFocusParams = (params) => {
  if (!params) {
    return null;
  }

  const shoutoutParam = params.get('shoutout');
  if (!shoutoutParam) {
    return null;
  }

  const shoutoutId = Number.parseInt(shoutoutParam, 10);
  if (Number.isNaN(shoutoutId) || shoutoutId <= 0) {
    return null;
  }

  const commentParam = params.get('comment');
  let commentId = null;
  if (commentParam) {
    const parsedComment = Number.parseInt(commentParam, 10);
    if (!Number.isNaN(parsedComment) && parsedComment > 0) {
      commentId = parsedComment;
    }
  }

  return { shoutoutId, commentId };
};

const DEPARTMENT_OPTIONS = ['HR', 'Finance', 'Marketing', 'Product Development', 'Quality Assurance', 'Security'];

export default function Feed() {
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterSender, setFilterSender] = useState('');
  const [senderOptions, setSenderOptions] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingFocus, setPendingFocus] = useState(() => parseFocusParams(searchParams));
  const [highlightedShoutoutId, setHighlightedShoutoutId] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const focusAppliedRef = useRef(null);

  const handleFocusHandled = useCallback(() => {
    setPendingFocus(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('shoutout');
    nextParams.delete('comment');
    if (Array.from(nextParams.keys()).length === 0) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const parsed = parseFocusParams(searchParams);
    setPendingFocus((prev) => {
      if (!parsed && !prev) {
        return prev;
      }
      if (parsed && prev && parsed.shoutoutId === prev.shoutoutId && parsed.commentId === prev.commentId) {
        return prev;
      }
      return parsed;
    });
  }, [searchParams]);

  useEffect(() => {
    if (!pendingFocus) {
      focusAppliedRef.current = null;
    }
  }, [pendingFocus]);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(() => setIsMounted(true), 16);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!pendingFocus?.shoutoutId) {
      return;
    }

    const targetExists = shoutouts.some((item) => item.id === pendingFocus.shoutoutId);
    if (!targetExists) {
      return;
    }

    if (focusAppliedRef.current === pendingFocus.shoutoutId && pendingFocus.commentId) {
      return;
    }

    focusAppliedRef.current = pendingFocus.shoutoutId;
    setHighlightedShoutoutId(pendingFocus.shoutoutId);

    const scrollToCard = () => {
      const element = document?.querySelector?.(`[data-shoutout-id="${pendingFocus.shoutoutId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToCard);
    } else {
      scrollToCard();
    }

    if (!pendingFocus.commentId) {
      handleFocusHandled();
    }
  }, [pendingFocus, shoutouts, handleFocusHandled]);

  useEffect(() => {
    if (!highlightedShoutoutId) {
      return undefined;
    }
    const timer = setTimeout(() => setHighlightedShoutoutId(null), 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [highlightedShoutoutId]);

  const fetchShoutouts = useCallback(async (options = {}) => {
    const opts = (options && typeof options === 'object' && !('nativeEvent' in options)) ? options : {};
    const { silent = false } = opts;

    if (!silent) {
      setLoading(true);
    }
    try {
      const params = { all_departments: true }; // Fetch from all departments
      if (filterDept) params.department = filterDept;
      if (filterSender) params.sender_id = filterSender;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const response = await shoutoutAPI.getAll(params);
      setShoutouts(response.data);
    } catch (error) {
      console.error('Error fetching shoutouts:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [filterDept, filterSender, startDate, endDate]);

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  useEffect(() => {
    if (!feedback.message) return undefined;
    const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Simple sender autocomplete when user types 2+ chars
  const handleSenderInput = async (val) => {
    setFilterSender(val);
    if (val && String(val).length >= 2 && isNaN(Number(val))) {
      try {
        const { data } = await userAPI.search(val);
        setSenderOptions(data || []);
      } catch {
        setSenderOptions([]);
      }
    } else {
      setSenderOptions([]);
    }
  };

  const resetFilters = () => {
    setFilterDept('');
    setFilterSender('');
    setStartDate('');
    setEndDate('');
  };

  const handleCreateShoutout = async (data) => {
    try {
      await shoutoutAPI.create(data);
      setShowCreateModal(false);
      setFeedback({ type: 'success', message: 'Shout-out posted successfully.' });
      fetchShoutouts();
    } catch (error) {
      console.error('Error creating shoutout:', error);
      const detail = error?.response?.data?.detail || 'Failed to create shout-out.';
      setFeedback({ type: 'error', message: detail });
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
      setFeedback({ type: 'error', message: 'Unable to update reaction. Please try again.' });
    }
  };

  // Align signature with ShoutoutCard: second arg is a payload { content, mentions }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
  <div
      className={`min-h-screen bg-gray-50 dark:bg-gray-950 theme-transition feed-page ${isMounted ? 'is-mounted' : ''}`}
      key={(document?.documentElement?.classList.contains('dark') ? 'dark' : 'light')}
    >
      <div className="max-w-2xl mx-auto py-8 px-4 page-container feed-shell">
        {feedback.message && (
          <div
            className={`mb-4 px-4 py-3 rounded border flex items-start justify-between gap-3 feed-feedback ${
              feedback.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-700 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300'
            }`}
          >
            <span className="text-sm flex-1">{feedback.message}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setFeedback({ type: '', message: '' })}
              className="text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        )}
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Quantum Stream</h1>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFilters(f => !f)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800 w-full sm:w-auto"
              >{showFilters ? 'Hide Filters' : 'Show Filters'}</button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
              >
                Create Shout-Out
              </button>
            </div>
          </div>
          {showFilters && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end feed-filters">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Department (Sender)</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="border px-2 py-1 rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Departments</option>
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col relative w-full sm:w-auto">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Sender</label>
              <input
                value={filterSender}
                onChange={(e) => handleSenderInput(e.target.value)}
                placeholder="Sender ID or name"
                className="border px-2 py-1 rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              {senderOptions.length > 0 && isNaN(Number(filterSender)) && (
                <ul className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 text-sm max-h-48 overflow-auto">
                  {senderOptions.map(u => (
                    <li
                      key={u.id}
                      onMouseDown={(e) => { e.preventDefault(); setFilterSender(String(u.id)); setSenderOptions([]); }}
                      className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-900 dark:text-gray-100"
                    >{u.name} (#{u.id})</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border px-2 py-1 rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            {/* <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border px-2 py-1 rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div> */}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <button
                type="button"
                onClick={fetchShoutouts}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 w-full sm:w-auto"
              >Apply</button>
              <button
                type="button"
                onClick={resetFilters}
                className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600 w-full sm:w-auto"
              >Reset</button>
            </div>
          </div>
          )}
        </div>

        {shoutouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No shout-outs yet. Be the first to post!</p>
          </div>
        ) : (
          <div className="space-y-4 feed-list">
            <ErrorBoundary>
              {shoutouts.map((shoutout) => (
                <ShoutoutCard
                  key={shoutout.id}
                  shoutout={shoutout}
                  onReaction={handleReaction}
                  onComment={handleComment}
                  onRefresh={fetchShoutouts}
                  isHighlighted={highlightedShoutoutId === shoutout.id}
                  focusCommentId={pendingFocus?.shoutoutId === shoutout.id ? pendingFocus.commentId : null}
                  onFocusHandled={handleFocusHandled}
                />
              ))}
            </ErrorBoundary>
          </div>
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
