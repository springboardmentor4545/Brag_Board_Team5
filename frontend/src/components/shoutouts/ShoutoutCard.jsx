import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { commentAPI, reactionAPI, adminAPI, shoutoutAPI, userAPI } from '../../services/api';
import CommentInput from './CommentInput';
import Avatar from '../common/Avatar';
import { extractMentionIds, parseMentions, encodeMentionPayload } from '../../utils/mentions';
import { emitToast } from '../../utils/toast.js';
import { useAuth } from '../../context/AuthContext';
import '../../App.css';

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

export default function ShoutoutCard({
  shoutout,
  onReaction,
  onComment,
  onRefresh,
  isHighlighted = false,
  focusCommentId = null,
  onFocusHandled,
}) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [reactionDetails, setReactionDetails] = useState({ open: false, loading: false, counts: {}, usersByType: {} });
  const [reportModal, setReportModal] = useState(() => createInitialReportModalState());
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMessage, setEditMessage] = useState(shoutout.message || '');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [commentEditState, setCommentEditState] = useState({ commentId: null, value: '', submitting: false, error: '' });
  const [commentDeleteState, setCommentDeleteState] = useState({ open: false, commentId: null, submitting: false, error: '' });
  const [commentEditMention, setCommentEditMention] = useState({ query: '', suggestions: [], activeIndex: 0, show: false });
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const portalElement = typeof document !== 'undefined' ? document.body : null;
  // no local loading state required for now
  const reactionMenuTimeoutRef = useRef(null);
  const commentFeedbackTimeoutRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const commentEditTextareaRef = useRef(null);
  const commentContainerRef = useRef(null);
  const isOwner = Boolean(user?.id) && (user?.id === shoutout.sender_id || user?.id === shoutout.sender?.id);

  useEffect(() => () => {
    if (reactionMenuTimeoutRef.current) {
      clearTimeout(reactionMenuTimeoutRef.current);
    }
    if (commentFeedbackTimeoutRef.current) {
      clearTimeout(commentFeedbackTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setEditMessage(shoutout.message || '');
  }, [shoutout.message]);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(() => setIsMounted(true), 16);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!reportModal.open || typeof document === 'undefined') {
      return undefined;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [reportModal.open]);

  useEffect(() => {
    if (!actionsMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setActionsMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [actionsMenuOpen]);

  useEffect(() => {
    if (activeCommentMenu == null) return undefined;
    const handleOutside = (event) => {
      if (!event.target.closest('[data-comment-menu]')) {
        setActiveCommentMenu(null);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveCommentMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeCommentMenu]);

  useEffect(() => {
    if (!commentEditState.commentId) {
      setCommentEditMention((state) => {
        if (!state.show && !state.query && state.suggestions.length === 0) {
          return state;
        }
        return { query: '', suggestions: [], activeIndex: 0, show: false };
      });
      return;
    }

    const query = commentEditMention.query;
    if (!query) {
      setCommentEditMention((state) => {
        if (state.suggestions.length === 0 && !state.show) {
          return state;
        }
        return { ...state, suggestions: [], show: false, activeIndex: 0 };
      });
      return;
    }

    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        const { data } = await userAPI.search(query);
        if (cancelled) return;
        setCommentEditMention((state) => ({
          ...state,
          suggestions: (data || []).map((user) => ({ id: user.id, name: user.name })),
          activeIndex: 0,
          show: true,
        }));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch mention suggestions while editing comment:', error);
          setCommentEditMention((state) => ({ ...state, suggestions: [], show: false }));
        }
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [commentEditMention.query, commentEditState.commentId]);

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

  const highlightComment = useCallback((commentId) => {
    if (!commentId) {
      return;
    }
    setHighlightedCommentId(commentId);
    const scrollToComment = () => {
      const container = commentContainerRef.current;
      const target = container?.querySelector(`[data-comment-id="${commentId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToComment);
    } else {
      scrollToComment();
    }
  }, []);

  const loadComments = useCallback(async (options = {}) => {
    const config = options || {};
    const forceShow = Boolean(config.forceShow);
    const focusId = config.focusCommentId ?? null;

    if (showComments && !forceShow) {
      if (highlightedCommentId) {
        setHighlightedCommentId(null);
      }
      setShowComments(false);
      return;
    }

    if (showComments && forceShow && comments.length > 0) {
      if (focusId) {
        highlightComment(focusId);
      }
      return;
    }

    try {
      const response = await commentAPI.getAll(shoutout.id);
      setComments(response.data);
      setShowComments(true);
      if (focusId) {
        setTimeout(() => {
          highlightComment(focusId);
        }, 60);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }, [showComments, comments.length, highlightComment, highlightedCommentId, shoutout.id]);

  useEffect(() => {
    if (!focusCommentId) {
      return undefined;
    }
    let cancelled = false;

    const openAndFocus = async () => {
      try {
        await loadComments({ forceShow: true, focusCommentId });
      } finally {
        if (!cancelled) {
          onFocusHandled?.();
        }
      }
    };

    openAndFocus();

    return () => {
      cancelled = true;
    };
  }, [focusCommentId, loadComments, onFocusHandled]);

  useEffect(() => {
    if (!highlightedCommentId) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setHighlightedCommentId(null);
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [highlightedCommentId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    setCommentError('');
    setCommentSuccess('');
    if (commentFeedbackTimeoutRef.current) {
      clearTimeout(commentFeedbackTimeoutRef.current);
    }

    if (!commentText.trim()) {
      setCommentError('Comment cannot be empty.');
      return;
    }

    const mentions = extractMentionIds(commentText);

    try {
      const createdComment = await onComment(shoutout.id, { content: commentText, mentions });
      setCommentText('');
      if (showComments && createdComment) {
        setComments((prev) => [...prev, createdComment]);
      }
      onRefresh?.({ silent: true });
      setCommentSuccess('Comment posted successfully.');
      commentFeedbackTimeoutRef.current = setTimeout(() => setCommentSuccess(''), 3000);
    } catch (error) {
      console.error('Error adding comment:', error);
      const detail = error?.response?.data?.detail || 'Unable to add comment.';
      setCommentError(detail);
    }
  };

  const handleReactionClick = (type) => {
    const currentReactions = Array.isArray(shoutout.user_reactions) ? [...shoutout.user_reactions] : [];
    const isAdding = !currentReactions.includes(type);
    const replacedTypes = isAdding ? currentReactions.filter((reaction) => reaction !== type) : [];

    onReaction(shoutout.id, type, isAdding, replacedTypes);

    if (reactionDetails.open && !reactionDetails.loading && user) {
      setReactionDetails((prev) => {
        if (!prev.open) {
          return prev;
        }

        const nextCounts = { ...(prev.counts || {}) };
        const nextUsersByType = { ...(prev.usersByType || {}) };

        const removeUserFromType = (reactionType) => {
          if (typeof nextCounts[reactionType] === 'number') {
            nextCounts[reactionType] = Math.max(nextCounts[reactionType] - 1, 0);
          }
          if (Array.isArray(nextUsersByType[reactionType])) {
            nextUsersByType[reactionType] = nextUsersByType[reactionType].filter((entry) => entry?.id !== user.id);
          }
        };

        const addUserToType = (reactionType) => {
          nextCounts[reactionType] = (nextCounts[reactionType] || 0) + 1;
          const existing = Array.isArray(nextUsersByType[reactionType])
            ? [...nextUsersByType[reactionType]]
            : [];
          if (!existing.some((entry) => entry?.id === user.id)) {
            existing.push({
              id: user.id,
              name: user.name,
              email: user.email,
              avatar_url: user.avatar_url,
            });
          }
          nextUsersByType[reactionType] = existing;
        };

        if (isAdding) {
          replacedTypes.forEach(removeUserFromType);
          addUserToType(type);
        } else {
          removeUserFromType(type);
        }

        return {
          ...prev,
          counts: nextCounts,
          usersByType: nextUsersByType,
        };
      });
    }
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

  const openReportShoutoutModal = () => {
    setActionsMenuOpen(false);
    setReportModal({
      ...createInitialReportModalState(),
      open: true,
      targetType: 'shoutout',
      targetId: shoutout.id,
      context: {
        preview: shoutout.message,
        author: shoutout.sender?.name,
      },
    });
  };

  const openEditModal = () => {
    setEditMessage(shoutout.message || '');
    setEditError('');
    setEditModalOpen(true);
    setActionsMenuOpen(false);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditError('');
  };

  const promptDeleteShoutout = () => {
    if (!isOwner) {
      return;
    }
    setActionsMenuOpen(false);
    setDeleteError('');
    setDeleteSubmitting(false);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteError('');
    setDeleteSubmitting(false);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    const trimmed = (editMessage || '').trim();
    if (!trimmed) {
      setEditError('Message cannot be empty.');
      return;
    }
    if (trimmed === (shoutout.message || '').trim()) {
      closeEditModal();
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      await shoutoutAPI.update(shoutout.id, { message: trimmed }, { skipErrorToast: true });
      emitToast('success', 'Shout-out updated.');
      closeEditModal();
      onRefresh?.();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update shout-out.';
      setEditError(detail);
      emitToast('error', detail);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteShoutout = async () => {
    if (!isOwner) {
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await shoutoutAPI.delete(shoutout.id, { skipErrorToast: true });
      emitToast('success', 'Shout-out deleted.');
      closeDeleteModal();
      onRefresh?.();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to delete shout-out.';
      emitToast('error', detail);
      setDeleteError(detail);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openReportCommentModal = (comment) => {
    setActiveCommentMenu(null);
    setReportModal({
      ...createInitialReportModalState(),
      open: true,
      targetType: 'comment',
      targetId: comment.id,
      context: {
        preview: comment.content,
        author: comment.user?.name,
      },
    });
  };

  const startEditComment = (comment) => {
    setCommentEditState({ commentId: comment.id, value: comment.content || '', submitting: false, error: '' });
    setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
    setActiveCommentMenu(null);
  };

  const cancelEditComment = () => {
    setCommentEditState({ commentId: null, value: '', submitting: false, error: '' });
    setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
    if (commentEditTextareaRef.current) {
      commentEditTextareaRef.current.blur();
    }
  };

  const handleCommentEditSubmit = async (event) => {
    event.preventDefault();
    const { commentId } = commentEditState;
    if (!commentId) {
      return;
    }
    const trimmed = (commentEditState.value || '').trim();
    if (!trimmed) {
      setCommentEditState((state) => ({ ...state, error: 'Comment cannot be empty.' }));
      return;
    }
    setCommentEditState((state) => ({ ...state, submitting: true, error: '' }));
    try {
      const response = await commentAPI.update(commentId, { content: trimmed }, { skipErrorToast: true });
      const updatedComment = response.data;
      setComments((prev) => prev.map((comment) => (comment.id === updatedComment.id ? { ...comment, ...updatedComment } : comment)));
      emitToast('success', 'Comment updated.');
      cancelEditComment();
      setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update comment.';
      emitToast('error', detail);
      setCommentEditState((state) => (state.commentId === commentId ? { ...state, error: detail } : state));
    } finally {
      setCommentEditState((state) => (state.commentId === commentId ? { ...state, submitting: false } : state));
    }
  };

  const handleCommentEditChange = (event) => {
    const value = event.target.value;
    const caret = event.target.selectionStart;
    setCommentEditState((state) => ({ ...state, value, error: '' }));
    const triggerIndex = value.lastIndexOf('@', caret - 1);
    if (triggerIndex >= 0) {
      const slice = value.slice(triggerIndex + 1, caret);
      if (/^[A-Za-z0-9_]{0,30}$/.test(slice)) {
        setCommentEditMention((state) => ({ ...state, query: slice, show: true }));
        return;
      }
    }
    if (commentEditMention.query || commentEditMention.show) {
      setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
    }
  };

  const insertMentionIntoEdit = (user) => {
    const textarea = commentEditTextareaRef.current;
    setCommentEditState((state) => {
      const currentText = state.value || '';
      const caretPosition = textarea ? textarea.selectionStart : currentText.length;
      const triggerIndex = currentText.lastIndexOf('@', caretPosition - 1);
      if (triggerIndex < 0) {
        return state;
      }
      const before = currentText.slice(0, triggerIndex);
      const after = currentText.slice(caretPosition);
      const encodedMention = `@${user.name}${encodeMentionPayload(user.id)}`;
      const nextValue = `${before}${encodedMention} ${after}`;

      requestAnimationFrame(() => {
        if (textarea) {
          const newPosition = before.length + encodedMention.length + 1;
          textarea.focus();
          textarea.selectionStart = newPosition;
          textarea.selectionEnd = newPosition;
        }
      });

      return { ...state, value: nextValue, error: '' };
    });
    setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
  };

  const handleCommentEditKeyDown = (event) => {
    if (!commentEditMention.show || !commentEditMention.suggestions.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCommentEditMention((state) => ({
        ...state,
        activeIndex: (state.activeIndex + 1) % state.suggestions.length,
      }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCommentEditMention((state) => ({
        ...state,
        activeIndex: (state.activeIndex - 1 + state.suggestions.length) % state.suggestions.length,
      }));
    } else if (event.key === 'Enter') {
      if (commentEditMention.query) {
        event.preventDefault();
        const selected = commentEditMention.suggestions[commentEditMention.activeIndex];
        if (selected) {
          insertMentionIntoEdit(selected);
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCommentEditMention({ query: '', suggestions: [], activeIndex: 0, show: false });
    }
  };

  const openDeleteCommentModal = (comment) => {
    const ownerId = comment?.user?.id ?? comment?.user_id;
    if (!user?.id || ownerId !== user.id) {
      return;
    }
    setCommentDeleteState({ open: true, commentId: comment.id, submitting: false, error: '' });
    setActiveCommentMenu(null);
  };

  const closeDeleteCommentModal = () => {
    setCommentDeleteState({ open: false, commentId: null, submitting: false, error: '' });
  };

  const handleDeleteComment = async () => {
    const { commentId } = commentDeleteState;
    if (!commentId) {
      return;
    }
    setCommentDeleteState((state) => ({ ...state, submitting: true, error: '' }));
    try {
      await commentAPI.delete(commentId, { skipErrorToast: true });
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      emitToast('success', 'Comment deleted.');
      closeDeleteCommentModal();
      onRefresh?.();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to delete comment.';
      emitToast('error', detail);
      setCommentDeleteState((state) => (state.commentId === commentId ? { ...state, error: detail, submitting: false } : state));
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
  const createdAtLabel = formatDate(shoutout.created_at);
  let updatedAtLabel = null;
  if (shoutout.updated_at) {
    const createdTime = new Date(shoutout.created_at).getTime();
    const updatedTime = new Date(shoutout.updated_at).getTime();
    if (!Number.isNaN(createdTime) && !Number.isNaN(updatedTime) && Math.abs(updatedTime - createdTime) > 1000) {
      updatedAtLabel = formatDate(shoutout.updated_at);
    }
  }

  return (
    <div
      data-shoutout-id={shoutout.id}
      className={`shoutout-card bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow p-4 sm:p-6 card transition-shadow ${
        isMounted ? 'is-mounted' : ''
      } ${isHighlighted ? 'ring-2 ring-blue-400 dark:ring-blue-500 shadow-lg shoutout-card--highlight' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:space-x-3 mb-4 shoutout-card-header">
        <div className="flex-shrink-0">
          <Avatar src={shoutout.sender?.avatar_url} name={shoutout.sender?.name} />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{shoutout.sender?.name || 'Unknown'}</p>
              {shoutout.sender?.department && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{shoutout.sender.department}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">{createdAtLabel}</p>
              {updatedAtLabel && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">Updated {updatedAtLabel}</p>
              )}
            </div>
            {user && (
              <div ref={actionsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((prev) => !prev)}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-haspopup="true"
                  aria-expanded={actionsMenuOpen}
                  aria-label="Shout-out actions"
                >
                  ⋮
                </button>
                {actionsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20">
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={openEditModal}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Edit shout-out
                        </button>
                        <button
                          type="button"
                          onClick={promptDeleteShoutout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          Delete shout-out
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700" />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={openReportShoutoutModal}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Report shout-out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-gray-800 dark:text-gray-100 mt-2 whitespace-pre-wrap break-words">{renderMentions(shoutout.message)}</p>
          {Array.isArray(shoutout.attachments) && shoutout.attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 shoutout-card-attachments">
              {shoutout.attachments.map((att, idx) => (
                <AttachmentPreview key={idx} attachment={att} />
              ))}
            </div>
          )}
          <div className="mt-2">
            <p className="text-sm text-gray-600 dark:text-gray-300 shoutout-card-tags">
              Tagged: {(shoutout.recipients || []).map(r => r.name).join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 dark:border-gray-800 pt-4 shoutout-card-footer">
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
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 flex gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg px-3 py-2 z-10 shoutout-card-reaction-menu"
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
      </div>

      {reactionDetails.open && (
        <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-md p-3 bg-gray-50 dark:bg-gray-800 shoutout-card-reaction-details">
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
        <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-4 shoutout-card-comments-wrapper">
          <div className="space-y-3 mb-4 shoutout-card-comments" ref={commentContainerRef}>
            {comments.map((comment) => {
              const ownerId = comment?.user?.id ?? comment?.user_id;
              const isCommentOwner = Boolean(user?.id) && ownerId === user.id;
              const isMenuOpen = activeCommentMenu === comment.id;
              const isEditingComment = commentEditState.commentId === comment.id;
              const createdLabel = formatDate(comment.created_at);
              let editedLabel = null;
              if (comment.updated_at) {
                const createdTime = new Date(comment.created_at).getTime();
                const updatedTime = new Date(comment.updated_at).getTime();
                if (!Number.isNaN(createdTime) && !Number.isNaN(updatedTime) && Math.abs(updatedTime - createdTime) > 1000) {
                  editedLabel = formatDate(comment.updated_at);
                }
              }
              const isHighlightedComment = highlightedCommentId === comment.id;
              return (
                <div key={comment.id} data-comment-id={comment.id} className="flex space-x-2 shoutout-card-comment">
                  <div className="flex-shrink-0">
                    <Avatar src={comment.user?.avatar_url} name={comment.user?.name} size="sm" />
                  </div>
                  <div
                    className={`flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 transition-shadow shoutout-card-comment-body ${
                      isHighlightedComment ? 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{comment.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {createdLabel}
                          {editedLabel && (
                            <span className="ml-2 italic text-gray-500 dark:text-gray-400">Updated {editedLabel}</span>
                          )}
                        </p>
                      </div>
                      {user && (
                        <div data-comment-menu={comment.id} className="relative shoutout-card-comment-menu">
                          <button
                            type="button"
                            onClick={() => setActiveCommentMenu((prev) => (prev === comment.id ? null : comment.id))}
                            className="p-1.5 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-haspopup="true"
                            aria-expanded={isMenuOpen}
                            aria-label="Comment actions"
                          >
                            ⋮
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-40 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20 shoutout-card-comment-menu-dropdown">
                              {isCommentOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditComment(comment)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >
                                    Edit comment
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteCommentModal(comment)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  >
                                    Delete comment
                                  </button>
                                </>
                              )}
                              {!isCommentOwner && (
                                <button
                                  type="button"
                                  onClick={() => openReportCommentModal(comment)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Report comment
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditingComment ? (
                      <form onSubmit={handleCommentEditSubmit} className="mt-2 space-y-2">
                        <div className="relative">
                          <textarea
                            ref={commentEditTextareaRef}
                            value={commentEditState.value}
                            onChange={handleCommentEditChange}
                            onKeyDown={handleCommentEditKeyDown}
                            rows={3}
                            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Update your comment"
                          />
                          {commentEditMention.show && commentEditMention.suggestions.length > 0 && (
                            <ul className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow z-30 text-sm">
                              {commentEditMention.suggestions.map((suggestion, idx) => (
                                <li
                                  key={suggestion.id}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertMentionIntoEdit(suggestion);
                                  }}
                                  className={`px-3 py-2 cursor-pointer ${idx === commentEditMention.activeIndex ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'}`}
                                >
                                  @{suggestion.name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {commentEditState.error && (
                          <p className="text-xs text-red-600 dark:text-red-400">{commentEditState.error}</p>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditComment}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={commentEditState.submitting}
                            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {commentEditState.submitting ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-2 text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">{renderMentions(comment.content)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <CommentInput
            value={commentText}
            onChange={(v) => {
              setCommentText(v || '');
              if (commentError) {
                setCommentError('');
              }
              if (commentSuccess) {
                setCommentSuccess('');
              }
              if (commentFeedbackTimeoutRef.current) {
                clearTimeout(commentFeedbackTimeoutRef.current);
              }
            }}
            onAddComment={handleAddComment}
            errorMessage={commentError}
            successMessage={commentSuccess}
          />
        </div>
      )}

      {editModalOpen && portalElement &&
        createPortal(
          (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl border border-gray-200 dark:border-gray-800 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Shout-Out</h3>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    aria-label="Close edit shout-out dialog"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <textarea
                    rows={5}
                    value={editMessage}
                    onChange={(event) => {
                      setEditMessage(event.target.value);
                      if (editError) {
                        setEditError('');
                      }
                    }}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Update your shout-out message"
                  />
                  {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {editSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ),
          portalElement
        )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Shout-Out</h3>
              <button
                type="button"
                onClick={closeDeleteModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close delete shout-out dialog"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Are you sure you want to delete this shout-out? This action cannot be undone.
            </p>
            {deleteError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShoutout}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {commentDeleteState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Comment</h3>
              <button
                type="button"
                onClick={closeDeleteCommentModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close delete comment dialog"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">Are you sure you want to delete this comment? This action cannot be undone.</p>
            {commentDeleteState.error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{commentDeleteState.error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteCommentModal}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteComment}
                disabled={commentDeleteState.submitting}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {commentDeleteState.submitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModal.open && portalElement
        ? createPortal(
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
            />,
            portalElement
          )
        : null}
    </div>
  );
}

// Helper to render @mentions nicely from encoded markup using zero-width separators inserted client-side
function renderMentions(text) {
  if (!text) return null;
  const parts = [];
  const mentions = parseMentions(text);
  let cursor = 0;

  const pushSegments = (segments) => {
    if (!segments) return;
    if (Array.isArray(segments)) {
      parts.push(...segments);
    } else {
      parts.push(segments);
    }
  };

  if (!mentions.length) {
    return renderTextWithLinks(text);
  }

  mentions.forEach((mention, idx) => {
    if (mention.index > cursor) {
      const slice = text.slice(cursor, mention.index);
      pushSegments(renderTextWithLinks(slice, `pre-${idx}`));
    }
    parts.push(
      <span key={`m-${mention.index}-${idx}`} className="text-blue-600 font-medium">@{mention.display}</span>
    );
    cursor = mention.index + mention.length;
  });

  if (cursor < text.length) {
    pushSegments(renderTextWithLinks(text.slice(cursor), 'post'));
  }

  return parts;
}

function renderTextWithLinks(text, keyPrefix = 'text') {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  let lastIndex = 0;
  let match;
  const segments = [];
  let counter = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push(text.slice(lastIndex, start));
    }
    const url = match[0];
    segments.push(
      <a
        key={`${keyPrefix}-url-${counter}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-words break-all inline-block max-w-full"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {url}
      </a>
    );
    counter += 1;
    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  if (segments.length === 0) {
    return text;
  }

  return segments;
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
    <div className="report-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 sm:px-6">
      <div className="report-modal-panel bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between mb-4 report-modal-header">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
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
              <div className="report-modal-context mb-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                {context.author && (
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Author</p>
                )}
                {context.author && <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">{context.author}</p>}
                {context.preview && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Content</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{context.preview}</p>
                  </div>
                )}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <textarea
              rows={6}
              value={reason}
              onChange={(e) => onChange(e.target.value)}
              className="report-modal-textarea w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Describe what's inappropriate or needs review"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-3 report-modal-actions">
              <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={onSubmit} disabled={submitting} className="px-4 py-2 rounded-md bg-red-600 text-white shadow hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
