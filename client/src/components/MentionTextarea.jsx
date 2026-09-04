import { useCallback, useRef, useState } from 'react';
import Avatar from './Avatar';
import { NameWithBadge } from './BadgeIcon';
import { api } from '../api';

// Finds the @mention token (if any) the caret is currently sitting inside
// of — e.g. typing "hey @be|" (caret at |) matches "be". Returns null once
// the token is broken by whitespace/punctuation or the caret has moved
// past it, so the dropdown only shows while you're actively typing a name.
function findActiveMention(value, caret) {
  const uptoCaret = value.slice(0, caret);
  const at = uptoCaret.lastIndexOf('@');
  if (at === -1) return null;
  const before = uptoCaret[at - 1];
  if (before && /[a-zA-Z0-9_]/.test(before)) return null; // "foo@bar" isn't a mention
  const fragment = uptoCaret.slice(at + 1);
  if (!fragment || fragment.length > 20 || !/^[a-zA-Z0-9_]*$/.test(fragment)) return null;
  return { start: at, end: caret, query: fragment };
}

// A drop-in replacement for a plain <textarea>/<input> that pops up a
// @username autocomplete dropdown while typing a mention — used by the
// post composer, the reply box, and the bio editor so tagging someone is
// something you can actually discover, not just something that happens to
// work if you already know their exact handle.
export default function MentionTextarea({ as = 'textarea', value, onChange, onKeyDown, fieldRef, ...rest }) {
  const localRef = useRef(null);
  const ref = fieldRef || localRef;
  const [match, setMatch] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestId = useRef(0);

  const check = useCallback((val, caret) => {
    const m = findActiveMention(val, caret);
    setMatch(m);
    if (!m) {
      setSuggestions([]);
      return;
    }
    const id = ++requestId.current;
    api
      .search(m.query)
      .then((d) => {
        if (id !== requestId.current) return; // a newer keystroke already moved on
        const q = m.query.toLowerCase();
        const users = (d.users || []).filter((u) => u.username.toLowerCase().startsWith(q)).slice(0, 6);
        setSuggestions(users);
        setActiveIndex(0);
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    onChange(e);
    check(e.target.value, e.target.selectionStart);
  };

  const pick = (username) => {
    if (!match) return;
    const before = value.slice(0, match.start);
    const after = value.slice(match.end);
    const insertion = `@${username} `;
    const caret = (before + insertion).length;
    onChange({ target: { value: before + insertion + after } });
    setMatch(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(suggestions[activeIndex].username);
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMatch(null);
        setSuggestions([]);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const Field = as;

  return (
    <div className="mention-input-wrap">
      <Field
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // A row's onMouseDown already preventDefault()s so clicking it
        // never blurs the field in the first place; this is only the
        // safety net for closing the dropdown after clicking elsewhere.
        onBlur={() => setTimeout(() => setSuggestions([]), 120)}
        {...rest}
      />
      {suggestions.length > 0 && (
        <div className="mention-dropdown">
          {suggestions.map((u, i) => (
            <div
              key={u.id}
              className={`mention-dropdown-row${i === activeIndex ? ' active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u.username);
              }}
            >
              <Avatar user={u} size={28} linkToProfile={false} />
              <div className="mention-dropdown-text">
                <div className="mention-dropdown-name">
                  <NameWithBadge user={u} />
                </div>
                <div className="mention-dropdown-handle">@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
