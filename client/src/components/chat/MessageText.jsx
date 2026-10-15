import { Fragment } from 'react';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const URL_RX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function linkify(text, keyPrefix) {
  return text.split(URL_RX).map((part, i) =>
    i % 2 === 1 ? (
      <a key={`${keyPrefix}-${i}`} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
        {part}
      </a>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    )
  );
}

/**
 * Renders a message as plain text (never HTML), turning @mentions of real
 * members into chips and links into anchors.
 */
export default function MessageText({ message, nameOf, meId }) {
  const tokens = [];
  for (const id of message.mentions) {
    const name = nameOf(id);
    if (name) tokens.push({ text: `@${name}`, me: id === meId });
  }
  if (message.mentionsEveryone) tokens.push({ text: '@everyone', me: true });
  if (!tokens.length) return <>{linkify(message.text, 't')}</>;

  tokens.sort((a, b) => b.text.length - a.text.length);
  const rx = new RegExp(`(${tokens.map((t) => escape(t.text)).join('|')})`, 'gi');
  return (
    <>
      {message.text.split(rx).map((part, i) => {
        const token = tokens.find((t) => t.text.toLowerCase() === part.toLowerCase());
        if (!token) return <Fragment key={i}>{linkify(part, i)}</Fragment>;
        return (
          <span key={i} className={`rounded-md px-1 font-semibold ${token.me ? 'bg-mention-bg text-mention-text' : 'bg-brand-100 text-brand-800'}`}>
            {part}
          </span>
        );
      })}
    </>
  );
}
