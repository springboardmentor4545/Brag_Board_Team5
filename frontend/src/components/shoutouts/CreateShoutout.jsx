import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../../App.css';

export default function CreateShoutout({ onClose, onCreate }) {
  const [message, setMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientFeedback, setRecipientFeedback] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const searchDebounceRef = useRef(null);
  const fileInputRef = useRef(null);
  const recipientContainerRef = useRef(null);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0, width: 0 });
  const { user } = useAuth();
  const trimmedRecipientQuery = recipientQuery.trim();
  const shouldShowRecipientSuggestions = trimmedRecipientQuery.length > 0;

  useEffect(() => {
    const query = recipientQuery.trim();
    if (!query) {
      setRecipientSuggestions([]);
      setRecipientFeedback('');
      setRecipientLoading(false);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    let cancelled = false;
    searchDebounceRef.current = setTimeout(async () => {
      setRecipientLoading(true);
      try {
        const response = await userAPI.search(query);
        if (cancelled) return;
        const results = (response.data || [])
          .filter((candidate) => candidate.id !== user?.id && !selectedRecipients.some((r) => r.id === candidate.id));
        setRecipientSuggestions(results.slice(0, 12));
        setRecipientFeedback(results.length === 0 ? 'No matches found.' : '');
      } catch (error) {
        if (!cancelled) {
          console.error('Error searching users:', error);
          setRecipientSuggestions([]);
          setRecipientFeedback('Unable to load suggestions right now.');
        }
      } finally {
        if (!cancelled) {
          setRecipientLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [recipientQuery, selectedRecipients, user?.id]);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(() => setIsMounted(true), 16);
    return () => clearTimeout(timeout);
  }, []);

  const updateSuggestionPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const container = recipientContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const viewportPadding = 16;
    const availableWidth = Math.max(window.innerWidth - viewportPadding * 2, 240);
    const width = Math.min(rect.width, availableWidth);
    const maxLeft = window.innerWidth - viewportPadding - width;
    const clampedLeft = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
    const maxTop = window.innerHeight - viewportPadding - 72;
    const desiredTop = rect.bottom + 8;
    const clampedTop = Math.min(desiredTop, maxTop);
    setSuggestionPosition({ top: clampedTop, left: clampedLeft, width });
  }, []);

  useEffect(() => {
    if (!shouldShowRecipientSuggestions) return undefined;
    updateSuggestionPosition();
    const handleReposition = () => updateSuggestionPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [shouldShowRecipientSuggestions, recipientSuggestions.length, recipientLoading, updateSuggestionPosition]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFormError('Message cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('message', trimmedMessage);
      // Backend expects a list for recipient_ids via Form. Axios will send repeated keys for arrays
      selectedRecipients.forEach((recipient) => form.append('recipient_ids', recipient.id));
      files.forEach((f) => form.append('files', f));
      await onCreate(form);
    } catch (error) {
      console.error('Error creating shoutout:', error);
      const detail = error?.response?.data?.detail || 'Unable to create shout-out.';
      setFormError(detail);
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
    const attachmentRuleMessage = 'Attachments must be PNG, JPG, GIF, WEBP images or PDF files up to 5MB each.';
    if (filtered.length !== selected.length) {
      setFormError(attachmentRuleMessage);
    } else {
      setFormError((prev) => (prev === attachmentRuleMessage ? '' : prev));
    }
    setFiles(prev => [...prev, ...filtered]);
    // reset input so selecting the same file again triggers change
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRecipientInputChange = (e) => {
    setRecipientQuery(e.target.value);
    setRecipientFeedback('');
    requestAnimationFrame(updateSuggestionPosition);
  };

  const handleSelectRecipient = (recipient) => {
    if (!recipient || !recipient.id) return;
    setSelectedRecipients((prev) => {
      if (prev.some((existing) => existing.id === recipient.id)) {
        return prev;
      }
      return [...prev, { id: recipient.id, name: recipient.name, email: recipient.email, department: recipient.department }];
    });
    setRecipientQuery('');
    setRecipientSuggestions([]);
    setRecipientFeedback('');
  };

  const handleRemoveRecipient = (id) => {
    setSelectedRecipients((prev) => prev.filter((recipient) => recipient.id !== id));
  };

  const handleRecipientKeyDown = (e) => {
    if (e.key === 'Enter' && recipientSuggestions.length > 0) {
      e.preventDefault();
      handleSelectRecipient(recipientSuggestions[0]);
    } else if (e.key === 'Backspace' && !recipientQuery && selectedRecipients.length > 0) {
      e.preventDefault();
      handleRemoveRecipient(selectedRecipients[selectedRecipients.length - 1].id);
    }
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const recipientSuggestionList =
    shouldShowRecipientSuggestions && portalTarget
      ? createPortal(
          (
            <div
              className="border border-gray-200 dark:border-gray-700 rounded-md shadow-lg bg-white dark:bg-gray-900 z-20 shoutout-suggestion-list"
              style={{
                top: suggestionPosition.top,
                left: suggestionPosition.left,
                width: suggestionPosition.width,
              }}
            >
              {recipientLoading ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 shoutout-suggestion shoutout-suggestion--info">Searching…</p>
              ) : recipientSuggestions.length > 0 ? (
                recipientSuggestions.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelectRecipient(candidate);
                    }}
                    className="w-full flex justify-between items-center px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/40 shoutout-suggestion"
                  >
                    <span>{candidate.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{candidate.email}</span>
                  </button>
                ))
              ) : recipientFeedback ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 shoutout-suggestion shoutout-suggestion--info">{recipientFeedback}</p>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 shoutout-suggestion shoutout-suggestion--info">Keep typing to refine your search.</p>
              )}
            </div>
          ),
          portalTarget
        )
      : null;

  return (
    <>
      <div className={`fixed inset-0 flex items-center justify-center p-4 z-50 shoutout-modal ${isMounted ? 'is-mounted' : ''}`}>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-xl md:max-w-2xl p-4 md:p-6 max-h-[85vh] overflow-y-auto shoutout-panel">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100 shoutout-panel-title">Create Shout-Out</h2>
          <form onSubmit={handleSubmit} className="shoutout-form">
            {formError && (
              <div className="mb-4 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-2 rounded shoutout-alert">
                {formError}
              </div>
            )}
            <div className="mb-4 shoutout-section">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 shoutout-section-title">
                Message
              </label>
              <textarea
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 shoutout-message"
                rows="4"
                placeholder="Write your shout-out message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="mb-6 grid gap-6 md:grid-cols-3 shoutout-grid">
              <div className="md:col-span-2 shoutout-section">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 shoutout-section-title">
                  Tag Teammates{selectedRecipients.length > 0 ? ` — ${selectedRecipients.length} selected` : ''}
                </label>
                <div className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-3 h-full shoutout-recipient-box">
                  {selectedRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 shoutout-chip-group">
                      {selectedRecipients.map((recipient) => (
                        <span
                          key={recipient.id}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-3 py-1 text-sm shoutout-chip"
                        >
                          <span>{recipient.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(recipient.id)}
                            className="leading-none text-blue-600 dark:text-blue-200 hover:text-blue-800 dark:hover:text-blue-100"
                            aria-label={`Remove ${recipient.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div ref={recipientContainerRef} className="relative shoutout-recipient-search">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500 shoutout-recipient-icon"
                      aria-hidden="true"
                    >
                      🔍
                    </span>
                    <input
                      type="text"
                      value={recipientQuery}
                      onChange={handleRecipientInputChange}
                      onKeyDown={handleRecipientKeyDown}
                      placeholder="Search teammates by name or email"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 shoutout-recipient-input"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 shoutout-section">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 shoutout-section-title">
                  Attachments
                </label>
                <div className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-3 h-full flex flex-col gap-3 shoutout-attachments">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleFileClick}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 shoutout-attachment-trigger"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shoutout-attachment-list">
                      {files.map((f, idx) => (
                        <div key={idx} className="relative border rounded p-2 bg-gray-50 dark:bg-gray-800 shoutout-attachment-item">
                          {f.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover rounded" />
                          ) : (
                            <div className="h-20 flex items-center justify-center text-sm text-gray-600 dark:text-gray-300">PDF: {f.name}</div>
                          )}
                          <button type="button" onClick={() => removeFile(idx)} className="absolute top-1 right-1 text-xs bg-red-500 text-white rounded px-1 shoutout-attachment-remove">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 pt-4 mt-6 bg-white dark:bg-gray-900 flex justify-end gap-3 shoutout-actions">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shoutout-action"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || message.trim().length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shoutout-action shoutout-action--primary"
              >
                {loading ? 'Creating...' : 'Create Shout-Out'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {recipientSuggestionList}
    </>
  );
}
