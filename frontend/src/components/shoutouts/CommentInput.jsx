import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { userAPI } from '../../services/api';
import { encodeMentionPayload } from '../../utils/mentions';

// Custom lightweight mention input: detects '@', shows suggestions, inserts hidden ID markup using zero-width joins
export default function CommentInput({
  value = '',
  onChange = () => {},
  onAddComment = () => {},
  errorMessage = '',
  successMessage = '',
}) {
  const propValue = typeof value === 'string' ? value : (value?.toString?.() ?? '');
  const [text, setText] = useState(propValue);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setText(propValue);
  }, [propValue]);

  useEffect(() => {
    const fetch = async () => {
      if (!query) { setSuggestions([]); return; }
      try {
        const { data } = await userAPI.search(query);
        setSuggestions((data || []).map(u => ({ id: u.id, name: u.name })));
        setActiveIndex(0);
      } catch (e) {
        console.error('mention search failed', e);
        setSuggestions([]);
      }
    };
    fetch();
  }, [query]);

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
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const viewportPadding = 16;
    const availableWidth = Math.max(window.innerWidth - viewportPadding * 2, 220);
    const width = Math.min(rect.width, availableWidth);
    const maxLeft = window.innerWidth - viewportPadding - width;
    const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
    const top = Math.min(rect.bottom + 8, window.innerHeight - viewportPadding - 56);
    setSuggestionPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!showSuggestions) return undefined;
    updateSuggestionPosition();
    const handleReposition = () => updateSuggestionPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [showSuggestions, updateSuggestionPosition]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    onChange(val);
    const caret = e.target.selectionStart;
    const triggerIndex = val.lastIndexOf('@', caret - 1);
    if (triggerIndex >= 0) {
      // stop if space or newline before caret
      const slice = val.slice(triggerIndex + 1, caret);
      if (/^[A-Za-z0-9_]{0,30}$/.test(slice)) {
        setQuery(slice);
        setShowSuggestions(true);
        requestAnimationFrame(updateSuggestionPosition);
        return;
      }
    }
    setShowSuggestions(false);
    setQuery('');
  };

  const insertMention = (user) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const triggerIndex = text.lastIndexOf('@', caret - 1);
    if (triggerIndex < 0) return;
    const before = text.slice(0, triggerIndex);
    const after = text.slice(caret);
    const encodedMention = `@${user.name}${encodeMentionPayload(user.id)}`;
    const next = before + encodedMention + ' ' + after; // append space after mention
    setText(next);
    onChange(next);
    setShowSuggestions(false);
    setQuery('');
    // move caret after inserted mention + space
    const newPos = (before + encodedMention + ' ').length;
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = newPos;
    });
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        if (query) {
          e.preventDefault();
          insertMention(suggestions[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false); setQuery('');
      }
    }
  };

  const handleSubmit = (e) => {
    onAddComment(e);
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const suggestionList =
    showSuggestions && suggestions.length > 0 && portalTarget
      ? createPortal(
          (
            <ul
              className="absolute mt-1 w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow z-50 text-sm comment-input-suggestions"
              style={{
                top: suggestionPosition.top,
                left: suggestionPosition.left,
                width: suggestionPosition.width,
              }}
            >
              {suggestions.map((s, idx) => (
                <li
                  key={s.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(s);
                  }}
                  className={`px-3 py-2 cursor-pointer comment-input-suggestion ${idx === activeIndex ? 'is-active' : ''}`}
                >
                  @{s.name}
                </li>
              ))}
            </ul>
          ),
          portalTarget
        )
      : null;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={`flex space-x-2 items-start relative comment-input ${isMounted ? 'is-mounted' : ''}`}
      >
        <div ref={containerRef} className="flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... Use @ to tag"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 comment-input-textarea"
          rows={1}
        />
        {errorMessage && (
          <p className="mt-1 text-xs text-red-600 comment-input-feedback" role="alert">{errorMessage}</p>
        )}
        {successMessage && !errorMessage && (
          <p className="mt-1 text-xs text-green-600 comment-input-feedback">{successMessage}</p>
        )}
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 comment-input-submit"
        >
          Post
        </button>
      </form>
      {suggestionList}
    </>
  );
}
