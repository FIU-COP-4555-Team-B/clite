import { useEffect, useRef } from 'react';
import type { Position, Span } from '../lexer/types';

interface SourceViewProps {
  source: string;
  position: Position;
  span: Span | null;
}

export function SourceView({ source, position, span }: SourceViewProps) {
  const start = span?.start.offset ?? position.offset;
  const end = span?.end.offset ?? position.offset;
  const viewport = useRef<HTMLPreElement>(null);
  const marker = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!viewport.current || !marker.current) return;

    const container = viewport.current.getBoundingClientRect();
    const active = marker.current.getBoundingClientRect();

    if (active.top < container.top + 20) {
      viewport.current.scrollTop += active.top - container.top - 20;
    } else if (active.bottom > container.bottom - 20) {
      viewport.current.scrollTop += active.bottom - container.bottom + 20;
    }

    if (active.left < container.left + 20) {
      viewport.current.scrollLeft += active.left - container.left - 20;
    } else if (active.right > container.right - 20) {
      viewport.current.scrollLeft += active.right - container.right + 20;
    }
  }, [source, start, end]);

  return (
    <div className="source-view">
      <pre aria-label="Source trace" tabIndex={0} ref={viewport}>
        <code>
          {source.slice(0, start)}
          {start === end ? (
            <span className="cursor" aria-label="Lexer cursor" ref={marker}>▏</span>
          ) : (
            <mark ref={marker}>{source.slice(start, end)}</mark>
          )}
          {source.slice(end)}
        </code>
      </pre>
    </div>
  );
}
