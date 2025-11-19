import { useRef, useState, useEffect } from 'react';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CreateShoutout({ onClose, onCreate }) {
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getUsers(user.department);
      setRecipients(response.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append('message', message);
      // Backend expects a list for recipient_ids via Form. Axios will send repeated keys for arrays
      selectedRecipients.forEach((id) => form.append('recipient_ids', id));
      files.forEach((f) => form.append('files', f));
      await onCreate(form);
    } catch (error) {
      console.error('Error creating shoutout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = () => fileInputRef.current?.click();
  const handleFilesSelected = (e) => {
    const selected = Array.from(e.target.files || []);
    // Basic front-end validation: types and size <= 5MB
    const allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/webp','application/pdf'];
    const filtered = selected.filter(f => allowed.includes(f.type) && f.size <= 5 * 1024 * 1024);
    setFiles(prev => [...prev, ...filtered]);
    // reset input so selecting the same file again triggers change
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleRecipient = (userId) => {
    setSelectedRecipients(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-xl md:max-w-2xl p-4 md:p-6 max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Create Shout-Out</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message
            </label>
            <textarea
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              rows="4"
              placeholder="Write your shout-out message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Recipients ({selectedRecipients.length} selected)
            </label>
            <div className="border border-gray-300 dark:border-gray-700 rounded-md max-h-56 md:max-h-60 overflow-y-auto p-3 space-y-2 bg-white dark:bg-gray-800">
              {recipients.map((recipient) => (
                <label key={recipient.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded text-gray-900 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(recipient.id)}
                    onChange={() => toggleRecipient(recipient.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span>{recipient.name} ({recipient.email})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attachments (optional)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleFileClick}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                title="Add attachments"
              >
                <span>📎</span>
                <span>Add files</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {files.map((f, idx) => (
                  <div key={idx} className="relative border rounded p-2 bg-gray-50 dark:bg-gray-800">
                    {f.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-24 object-cover rounded" />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-sm text-gray-600 dark:text-gray-300">PDF: {f.name}</div>
                    )}
                    <button type="button" onClick={() => removeFile(idx)} className="absolute top-1 right-1 text-xs bg-red-500 text-white rounded px-1">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 pt-4 mt-6 bg-white dark:bg-gray-900 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedRecipients.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Shout-Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
