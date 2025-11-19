import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { shoutoutAPI, commentAPI, reactionAPI, userAPI } from '../services/api';
import CreateShoutout from '../components/shoutouts/CreateShoutout';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';

const DEPARTMENT_OPTIONS = ['Sales', 'Marketing', 'Engineering', 'HR', 'Finance', 'Operations'].sort((a, b) => a.localeCompare(b));

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
  const { user } = useAuth();

  useEffect(() => {
    fetchShoutouts();
  }, [filterDept, filterSender, startDate, endDate]);

  const fetchShoutouts = async () => {
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
      setLoading(false);
    }
  };

  // Simple sender autocomplete when user types 2+ chars
  const handleSenderInput = async (val) => {
    setFilterSender(val);
    if (val && String(val).length >= 2 && isNaN(Number(val))) {
      try {
        const { data } = await userAPI.search(val);
        setSenderOptions(data || []);
      } catch (e) {
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

  // Align signature with ShoutoutCard: second arg is a payload { content, mentions }
  const handleComment = async (shoutoutId, payload) => {
    try {
      await commentAPI.create(shoutoutId, payload);
      fetchShoutouts();
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
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 theme-transition" key={(document?.documentElement?.classList.contains('dark') ? 'dark' : 'light')}>
      <div className="max-w-2xl mx-auto py-8 px-4 page-container">
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Departments Feed</h1>
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
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
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
          <div className="space-y-4">
            <ErrorBoundary>
              {shoutouts.map((shoutout) => (
                <ShoutoutCard
                  key={shoutout.id}
                  shoutout={shoutout}
                  onReaction={handleReaction}
                  onComment={handleComment}
                  onRefresh={fetchShoutouts}
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
