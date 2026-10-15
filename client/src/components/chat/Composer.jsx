import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon.jsx';
import { Avatar } from '../ui.jsx';

export const MAX_LENGTH = 2000; // FR-CHAT-13
const EVERYONE = { _id: 'everyone', name: 'everyone' };

// The "@query" being typed just before the caret, if any
function activeMention(text, caret) {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(before);
  return m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

/**
 * Message box with the @ member picker (FR-CHAT-05). Sends the text plus the
 * IDs of members whose "@Name" is still in it (FR-CHAT-06).
 */
export default function Composer({ members, meId, isAdmin, disabled, onSend, onTyping }) {
  const [text, setText] = useState('');
  const [mentioned, setMentioned] = useState(new Map()); // id -> name
  const [picker, setPicker] = useState(null); // { start, query }
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const pendingCaret = useRef(null);

  const options = useMemo(() => {
    if (!picker) return [];
    const q = picker.query;
    const people = members
      .map((m) => m.user)
      .filter((u) => u._id !== meId && (!q || u.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || u.name.toLowerCase().startsWith(q)));
    // FR-CHAT-10: only the admin is offered @everyone
    const all = isAdmin && 'everyone'.startsWith(q) ? [EVERYONE, ...people] : people;
    return all.slice(0, 6);
  }, [picker, members, meId, isAdmin]);

  useEffect(() => setActive(0), [picker?.query]);

  // Put the caret after an inserted mention before the next keystroke lands
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  // Grow with the text up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function update(value, caret) {
    setText(value);
    setPicker(activeMention(value, caret));
    if (value.trim()) onTyping();
  }

  function choose(option) {
    const el = ref.current;
    const caret = el.selectionStart;
    const insert = `@${option.name} `;
    const value = text.slice(0, picker.start) + insert + text.slice(caret);
    if (option._id !== 'everyone') setMentioned((m) => new Map(m).set(option._id, option.name));
    pendingCaret.current = picker.start + insert.length;
    setText(value);
    setPicker(null);
  }

  function send() {
    const body = text.trim();
    if (!body || body.length > MAX_LENGTH || disabled) return;
    const ids = [...mentioned].filter(([, name]) => body.includes(`@${name}`)).map(([id]) => id);
    onSend(body, ids);
    setText('');
    setMentioned(new Map());
    setPicker(null);
  }

  function onKeyDown(e) {
    if (picker && options.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        choose(options[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPicker(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const over = text.length > MAX_LENGTH;
  const listId = 'mention-options';

  return (
    <div className="relative px-3 pb-3 sm:px-5 sm:pb-5">
      {picker && options.length > 0 && (
        <div className="absolute bottom-full left-3 z-20 mb-2 w-[min(320px,calc(100%-24px))] animate-pop rounded-2xl border border-white bg-white/95 p-1.5 shadow-glass backdrop-blur-xl sm:left-5">
          <div className="eyebrow px-2.5 py-1.5">Mention</div>
          <ul id={listId} role="listbox" aria-label="Mention a member">
            {options.map((o, i) => (
              <li
                key={o._id}
                id={`mention-${o._id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${i === active ? 'bg-brand-50' : ''}`}
              >
                {o._id === 'everyone' ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-ink-soft">
                    <Icon name="at" size={15} />
                  </span>
                ) : (
                  <Avatar user={o} size={28} />
                )}
                <span className="font-medium">{o.name}</span>
                {o._id === 'everyone' && <span className="ml-auto text-xs text-ink-faint">admin only</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="solid flex items-end gap-2 rounded-2xl p-1.5 pl-4 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={disabled ? 'Reconnecting…' : 'Message — type @ to mention someone'}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          onClick={(e) => setPicker(activeMention(text, e.target.selectionStart))}
          onBlur={() => setTimeout(() => setPicker(null), 120)}
          role="combobox"
          aria-expanded={Boolean(picker && options.length)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={picker && options[active] ? `mention-${options[active]._id}` : undefined}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-6 outline-none placeholder:text-ink-faint focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button type="button" onClick={send} disabled={!text.trim() || over || disabled} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:bg-slate-300">
          <Icon name="send" size={18} />
        </button>
      </div>
      {text.length > MAX_LENGTH - 200 && (
        <p className={`mt-1.5 text-right text-xs ${over ? 'font-semibold text-red-700' : 'text-ink-muted'}`}>
          {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </p>
      )}
    </div>
  );
}
