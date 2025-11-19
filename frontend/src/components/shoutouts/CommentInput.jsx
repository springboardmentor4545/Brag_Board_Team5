import { useState, useEffect, useRef } from 'react';
import { userAPI } from '../../services/api';

// Custom lightweight mention input: detects '@', shows suggestions, inserts markup @[Name](id)
export default function CommentInput({ value = '', onChange = () => {}, onAddComment = () => {} }) {
  const propValue = typeof value === 'string' ? value : (value?.toString?.() ?? '');
  const [text, setText] = useState(propValue);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (propValue !== text) setText(propValue);
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
    const markup = `@[${user.name}](${user.id})`;
    const next = before + markup + ' ' + after; // append space after mention
    setText(next);
    onChange(next);
    setShowSuggestions(false);
    setQuery('');
    // move caret after inserted mention + space
    const newPos = (before + markup + ' ').length;
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

  return (
    <form onSubmit={onAddComment} className="flex space-x-2 items-start relative">
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... Use @ to tag"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          rows={1}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute mt-1 w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow z-50 text-sm">
            {suggestions.map((s, idx) => (
              <li
                key={s.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(s); }}
                className={`px-3 py-2 cursor-pointer ${idx === activeIndex ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'} text-gray-900 dark:text-gray-100`}
              >@{s.name}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Post</button>
    </form>
  );
}
