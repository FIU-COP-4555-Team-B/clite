import { useEffect, useRef } from 'react';
import type { Span, Token } from '../lexer/types';

interface TokenTableProps {
  tokens: readonly Token[];
  selectedSpan: Span | null;
  onSelect: (span: Span) => void;
}

export function TokenTable({ tokens, selectedSpan, onSelect }: TokenTableProps) {
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [tokens.length]);

  return (
    <section className="panel tokens-panel" aria-labelledby="tokens-heading">
      <div className="panel-heading">
        <h2 id="tokens-heading">Token stream</h2>
        <span>{tokens.length} emitted</span>
      </div>
      <div className="token-scroll" ref={viewport}>
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Kind</th><th scope="col">Lexeme</th><th scope="col">Span</th></tr></thead>
          <tbody>
            {tokens.map((token, index) => (
              <tr key={`${token.span.start.offset}-${token.kind}`} className={selectedSpan === token.span ? 'selected-token' : undefined}>
                <td>{index + 1}</td>
                <td><span className="token-kind">{token.kind}</span></td>
                <td>
                  <button className="lexeme-button" onClick={() => onSelect(token.span)} aria-label={`Inspect token ${index + 1}: ${token.kind}`}>
                    <code>{JSON.stringify(token.lexeme)}</code>
                  </button>
                </td>
                <td className="span-cell">{token.span.start.line}:{token.span.start.column}–{token.span.end.line}:{token.span.end.column}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokens.length === 0 && <p className="empty-state">Tokens appear here as the lexer recognizes them.</p>}
      </div>
    </section>
  );
}
