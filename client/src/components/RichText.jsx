import { Link } from 'react-router-dom';
import { tokenizeRichText } from '../utils';

export default function RichText({ text }) {
  const parts = tokenizeRichText(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'mention') {
          return (
            <Link key={i} className="mention" to={`/u/${p.value}`} onClick={(e) => e.stopPropagation()}>
              @{p.value}
            </Link>
          );
        }
        if (p.type === 'hashtag') {
          return (
            <Link key={i} className="hashtag" to={`/search?q=${encodeURIComponent('#' + p.value)}`} onClick={(e) => e.stopPropagation()}>
              #{p.value}
            </Link>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}
