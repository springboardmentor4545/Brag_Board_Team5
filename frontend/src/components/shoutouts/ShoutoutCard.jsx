import { useState, useRef, useEffect } from 'react';
import { commentAPI, reactionAPI, adminAPI } from '../../services/api';
import CommentInput from './CommentInput';
import Avatar from '../common/Avatar';

const REACTION_TYPES = [
  { type: 'like', label: 'Like', icon: '👍' },
  { type: 'clap', label: 'Clap', icon: '👏' },
  { type: 'star', label: 'Star', icon: '⭐' },
];

const createInitialReportModalState = () => ({
  open: false,
  targetType: null,
  targetId: null,
  context: null,
  reason: '',
  submitting: false,
  submitted: false,
  error: '',
});

export default function ShoutoutCard({ shoutout, onReaction, onComment, onRefresh }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [reactionDetails, setReactionDetails] = useState({ open: false, loading: false, counts: {}, usersByType: {} });
  const [reportModal, setReportModal] = useState(() => createInitialReportModalState());
  // no local loading state required for now
  const reactionMenuTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (reactionMenuTimeoutRef.current) {
      clearTimeout(reactionMenuTimeoutRef.current);
    }
  }, []);

  const openReactionMenu = () => {
    if (reactionMenuTimeoutRef.current) {
      clearTimeout(reactionMenuTimeoutRef.current);
      reactionMenuTimeoutRef.current = null;
    }
    setReactionMenuOpen(true);
  };

  const scheduleReactionMenuClose = () => {
    if (reactionMenuTimeoutRef.current) {
      clearTimeout(reactionMenuTimeoutRef.current);
    }
    reactionMenuTimeoutRef.current = setTimeout(() => {
      setReactionMenuOpen(false);
      reactionMenuTimeoutRef.current = null;
    }, 200);
  };

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    try {
      const response = await commentAPI.getAll(shoutout.id);
      setComments(response.data);
      setShowComments(true);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const mentionRegex = /@\[(.*?)\]\((.*?)\)/g;
    let match;
    const mentions = [];
    while ((match = mentionRegex.exec(commentText)) !== null) {
      mentions.push(match[2]);
    }

    try {
      await onComment(shoutout.id, { content: commentText, mentions });
      setCommentText('');
      // We need to reload the comments after adding a new one.
      // We can do this by calling onRefresh, which will refetch the shoutouts.
      onRefresh();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReactionClick = (type) => {
    const isAdding = !(shoutout.user_reactions || []).includes(type);
    onReaction(shoutout.id, type, isAdding);
    setReactionMenuOpen(false);
  };

  const closeReactionDetails = () => setReactionDetails({ open: false, loading: false, counts: {}, usersByType: {} });

  const toggleReactionDetails = async () => {
    if (reactionDetails.open) {
      closeReactionDetails();
      return;
    }
    setReactionDetails({ open: true, loading: true, counts: {}, usersByType: {} });
    try {
      const res = await reactionAPI.listAllUsers(shoutout.id);
      const counts = res.data?.counts || {};
      let usersByType = res.data?.users || {};

      const missingTypes = REACTION_TYPES.filter((reaction) => {
        const declaredCount = counts?.[reaction.type];
        const existingUsers = usersByType?.[reaction.type] || [];
        const needsUsers = (typeof declaredCount === 'number' && declaredCount > 0 && existingUsers.length === 0);
        return needsUsers;
      });

      if (missingTypes.length) {
        const fetched = await Promise.all(
          missingTypes.map(async (reaction) => {
            try {
              const extra = await reactionAPI.listUsers(shoutout.id, reaction.type);
              return extra.data?.users?.[reaction.type] || [];
            } catch (err) {
              console.error('Failed to fetch reaction users for type', reaction.type, err);
              return [];
            }
          })
        );

        usersByType = { ...usersByType };
        missingTypes.forEach((reaction, index) => {
          usersByType[reaction.type] = fetched[index];
        });
      }

      setReactionDetails({
        open: true,
        loading: false,
        counts,
        usersByType,
      });
    } catch (e) {
      console.error('Failed to load reaction details', e);
      setReactionDetails({ open: true, loading: false, counts: {}, usersByType: {} });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  const totalReactions = REACTION_TYPES.reduce(
    (total, reaction) => total + ((shoutout.reaction_counts || {})[reaction.type] || 0),
    0
  );

  const userReaction = REACTION_TYPES.find((reaction) => (shoutout.user_reactions || []).includes(reaction.type));

  const primaryReactionType = userReaction?.type || 'like';

  return (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow p-4 sm:p-6 card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:space-x-3 mb-4">
        <div className="flex-shrink-0">
          <Avatar src={shoutout.sender?.avatar_url} name={shoutout.sender?.name} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{shoutout.sender?.name || 'Unknown'}</p>
              {shoutout.sender?.department && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{shoutout.sender.department}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(shoutout.created_at)}</p>
            </div>
          </div>
          <p className="text-gray-800 dark:text-gray-100 mt-2">{shoutout.message}</p>
          {Array.isArray(shoutout.attachments) && shoutout.attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {shoutout.attachments.map((att, idx) => (
                <AttachmentPreview key={idx} attachment={att} />
              ))}
            </div>
          )}
          <div className="mt-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Tagged: {(shoutout.recipients || []).map(r => r.name).join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>

  <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 dark:border-gray-800 pt-4">
        <div
          className="relative"
          onMouseEnter={openReactionMenu}
          onMouseLeave={scheduleReactionMenuClose}
        >
          <button
            onClick={() => handleReactionClick(primaryReactionType)}
            className={`flex items-center space-x-2 px-2 py-1 rounded ${
              userReaction ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
            } hover:text-blue-600`}
          >
            <span>{userReaction?.icon || '👍'}</span>
            <span className="text-sm">{userReaction?.label || 'Like'}</span>
          </button>
          {reactionMenuOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 flex gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg px-3 py-2 z-10"
              onMouseEnter={openReactionMenu}
              onMouseLeave={scheduleReactionMenuClose}
            >
              {REACTION_TYPES.map((reaction) => (
                <button
                  key={reaction.type}
                  onClick={() => handleReactionClick(reaction.type)}
                  className={`flex flex-col items-center text-xs font-medium ${
                    (shoutout.user_reactions || []).includes(reaction.type)
                      ? 'text-blue-600'
                      : 'text-gray-600 dark:text-gray-300'
                  } hover:text-blue-600`}
                >
                  <span className="text-lg">{reaction.icon}</span>
                  <span>{reaction.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {totalReactions > 0 && (
          <button
            onClick={toggleReactionDetails}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600"
            aria-label="View reactions"
          >
            {totalReactions}
          </button>
        )}
        <button
          onClick={loadComments}
          className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-blue-600"
        >
          <span>💬</span>
          <span>{shoutout.comment_count ?? 0}</span>
        </button>
        <button
          onClick={() =>
            setReportModal({
              ...createInitialReportModalState(),
              open: true,
              targetType: 'shoutout',
              targetId: shoutout.id,
              context: {
                preview: shoutout.message,
                author: shoutout.sender?.name,
              },
            })
          }
          className="ml-auto text-sm text-red-600 hover:text-red-700"
          title="Report this shout-out"
        >
          Report
        </button>
      </div>

      {reactionDetails.open && (
        <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-md p-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Reactions</div>
            <button onClick={closeReactionDetails} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
          </div>
          {reactionDetails.loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : Object.values(reactionDetails.counts || {}).reduce((sum, val) => sum + val, 0) === 0 ? (
            <div className="text-sm text-gray-500">No reactions yet</div>
          ) : (
            <div className="space-y-3">
              {REACTION_TYPES.map((reaction) => {
                const users = reactionDetails.usersByType?.[reaction.type] || [];
                const count = reactionDetails.counts?.[reaction.type];
                const displayCount = typeof count === 'number' ? count : users.length;
                if (displayCount === 0 && users.length === 0) return null;
                return (
                  <div key={reaction.type} className="bg-white/60 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      <span className="text-lg">{reaction.icon}</span>
                      <span>{reaction.label}</span>
                      <span className="text-xs text-gray-500">{displayCount}</span>
                    </div>
                    <ul className="space-y-1">
                      {users.map((user) => (
                        <li key={user.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                          <Avatar src={user.avatar_url} name={user.name} size="xs" className="flex-shrink-0" />
                          <div>
                            <div>{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showComments && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-4">
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-2">
                <div className="flex-shrink-0">
                  <Avatar src={comment.user?.avatar_url} name={comment.user?.name} size="sm" />
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{comment.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</p>
                    </div>
                    <button
                      onClick={() =>
                        setReportModal({
                          ...createInitialReportModalState(),
                          open: true,
                          targetType: 'comment',
                          targetId: comment.id,
                          context: {
                            preview: comment.content,
                            author: comment.user?.name,
                          },
                        })
                      }
                      className="text-xs text-red-600 hover:text-red-700"
                      title="Report this comment"
                    >
                      Report
                    </button>
                  </div>
                  <p className="text-gray-800 dark:text-gray-100">{renderMentions(comment.content)}</p>
                </div>
              </div>
            ))}
          </div>
          <CommentInput
            value={commentText}
            onChange={(v) => setCommentText(v || '')}
            onAddComment={handleAddComment}
          />
        </div>
      )}

      {reportModal.open && (
        <ReportModal
          targetType={reportModal.targetType}
          context={reportModal.context}
          reason={reportModal.reason}
          submitting={reportModal.submitting}
          submitted={reportModal.submitted}
          error={reportModal.error}
          onChange={(v) => setReportModal((s) => ({ ...s, reason: v }))}
          onClose={() => setReportModal(createInitialReportModalState())}
          onSubmit={async () => {
            if (!reportModal.reason.trim()) {
              setReportModal((s) => ({ ...s, error: 'Please provide a reason.' }));
              return;
            }
            if (!reportModal.targetType || !reportModal.targetId) {
              setReportModal((s) => ({ ...s, error: 'Unable to determine what to report.' }));
              return;
            }
            try {
              setReportModal((s) => ({ ...s, submitting: true, error: '' }));
              const reason = reportModal.reason.trim();
              if (reportModal.targetType === 'shoutout') {
                await adminAPI.reportShoutout(reportModal.targetId, reason);
              } else if (reportModal.targetType === 'comment') {
                await commentAPI.report(reportModal.targetId, reason);
              } else {
                throw new Error('Unsupported report type');
              }
              setReportModal((s) => ({ ...s, submitting: false, submitted: true }));
            } catch (e) {
              const msg = e?.response?.data?.detail || e?.message || 'Failed to submit report';
              setReportModal((s) => ({ ...s, submitting: false, error: msg }));
            }
          }}
        />
      )}
    </div>
  );
}

// Helper to render @mentions nicely from markup @[display](id)
function renderMentions(text) {
  if (!text) return null;
  const nodes = [];
  const regex = /@\[(.+?)\]\((\d+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const display = match[1];
    nodes.push(
      <span key={`m-${match.index}`} className="text-blue-600 font-medium">@{display}</span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function AttachmentPreview({ attachment }) {
  const url = attachment?.url || attachment;
  const name = attachment?.name || (typeof attachment === 'string' ? attachment.split('/').pop() : 'file');
  const isImage = typeof attachment === 'object' ? (attachment.type || '').startsWith('image/') : /\.(png|jpe?g|gif|webp)$/i.test(url || '');
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      {isImage ? (
        <img src={url} alt={name} className="w-full h-40 object-cover rounded border border-gray-200 dark:border-gray-700" />
      ) : (
        <div className="h-40 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
          📄 {name}
        </div>
      )}
    </a>
  );
}

function ReportModal({ targetType, context, reason, submitting, submitted, error, onChange, onClose, onSubmit }) {
  const title = targetType === 'comment' ? 'Report Comment' : 'Report Shout-Out';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        {submitted ? (
          <div className="space-y-4">
            <p className="text-green-700 bg-green-50 border border-green-200 rounded p-3">Report submitted. Thank you.</p>
            <div className="text-right">
              <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
            </div>
          </div>
        ) : (
          <>
            {context && (context.preview || context.author) && (
              <div className="mb-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded p-3">
                {context.author && (
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Author</p>
                )}
                {context.author && <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">{context.author}</p>}
                {/* {context.preview && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Content</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{context.preview}</p>
                  </div>
                )} */}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => onChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Describe what's inappropriate or needs review"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700">Cancel</button>
              <button onClick={onSubmit} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
