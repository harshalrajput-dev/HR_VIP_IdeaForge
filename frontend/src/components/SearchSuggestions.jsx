import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from './StatusBadge';
import api from '../services/api';
import { truncate } from '../utils/format';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

/**
 * Typeahead over GET /api/ideas/search/suggestions.
 *
 * Suggestions are advisory only — the feed's own submit handler stays the
 * source of truth, so a failed lookup never blocks a normal search.
 */
export default function SearchSuggestions({ value, onSelect, inputRef, ...inputProps }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef(null);
  const requestId = useRef(0);

  const term = value.trim();

  useEffect(() => {
    if (term.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      setActive(-1);
      return undefined;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      api
        .get('/ideas/search/suggestions', { params: { q: term, limit: MAX_SUGGESTIONS } })
        .then((res) => {
          // Drop responses that a newer keystroke has already superseded.
          if (id !== requestId.current) return;
          setSuggestions(Array.isArray(res.data) ? res.data.slice(0, MAX_SUGGESTIONS) : []);
          setOpen(true);
        })
        .catch(() => {
          if (id === requestId.current) {
            setSuggestions([]);
            setOpen(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term]);

  // Close on an outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  const choose = (idea) => {
    setOpen(false);
    setActive(-1);
    onSelect(idea);
  };

  const onKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
        🔍
      </span>
      <input
        {...inputProps}
        ref={inputRef}
        type="search"
        value={value}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="input pl-10"
      />

      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-card"
        >
          {suggestions.map((idea, index) => (
            <li key={idea.id} role="option" aria-selected={index === active}>
              <Link
                to={`/ideas/${idea.id}`}
                onClick={() => choose(idea)}
                onMouseEnter={() => setActive(index)}
                className={
                  index === active
                    ? 'block bg-forge-50 px-3.5 py-2.5'
                    : 'block px-3.5 py-2.5 transition hover:bg-slate-50'
                }
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={idea.status} size="sm" />
                  <span className="truncate text-sm font-medium text-slate-800">{idea.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                  {idea.category} · {truncate(idea.description, 70)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
