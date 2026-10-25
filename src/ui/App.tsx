import { useEffect, useReducer, useRef, useState } from 'react';
import sample from '../../samples/full-scope.clite?raw';
import { createLexerState, step } from '../lexer/lexer';
import type { Diagnostic, LexerState as State, Span, Token, Transition } from '../lexer/types';
import { LexerState } from './LexerState';
import { SourceView } from './SourceView';
import { TokenTable } from './TokenTable';

interface Session {
  source: string;
  lexer: State;
  tokens: Token[];
  diagnostics: Diagnostic[];
  event: Transition | null;
  steps: number;
  running: boolean;
  complete: boolean;
}

type Action =
  | { type: 'source'; source: string }
  | { type: 'reset' }
  | { type: 'step' }
  | { type: 'play' }
  | { type: 'pause' };

function createSession(source: string): Session {
  return {
    source,
    lexer: createLexerState(),
    tokens: [],
    diagnostics: [],
    event: null,
    steps: 0,
    running: false,
    complete: false,
  };
}

function reduceSession(session: Session, action: Action): Session {
  switch (action.type) {
    case 'source':
      return createSession(action.source);
    case 'reset':
      return createSession(session.source);
    case 'play':
      return session.complete ? session : { ...session, running: true };
    case 'pause':
      return { ...session, running: false };
    case 'step': {
      if (session.complete) return session;

      const { state, event } = step(session.source, session.lexer);
      const complete = event.kind === 'finish';

      return {
        ...session,
        lexer: state,
        event,
        steps: session.steps + 1,
        tokens: event.kind === 'emit' || event.kind === 'finish' ? [...session.tokens, event.token] : session.tokens,
        diagnostics: event.kind === 'error' ? [...session.diagnostics, event.diagnostic] : session.diagnostics,
        running: complete ? false : session.running,
        complete,
      };
    }
  }
}

export function App() {
  const [session, dispatch] = useReducer(reduceSession, sample, createSession);
  const [delay, setDelay] = useState(60);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRevision = useRef(0);

  useEffect(() => {
    if (!session.running) return;

    const timer = window.setInterval(() => {
      setSelectedSpan(null);
      dispatch({ type: 'step' });
    }, delay);

    return () => window.clearInterval(timer);
  }, [session.running, delay]);

  function replaceSource(source: string) {
    fileRevision.current += 1;
    setSelectedSpan(null);
    setFileError(null);
    dispatch({ type: 'source', source });
  }

  async function loadFile(file: File) {
    const revision = ++fileRevision.current;

    dispatch({ type: 'pause' });
    setFileError(null);

    try {
      const source = await file.text();

      if (revision === fileRevision.current) replaceSource(source);
    } catch {
      if (revision === fileRevision.current) setFileError('Could not read this file. Try another local text file.');
    }
  }

  const status = session.complete ? 'Complete' : session.running ? 'Running' : session.steps > 0 ? 'Paused' : 'Ready';
  const highlightedSpan = selectedSpan ?? session.event?.span ?? null;

  return (
    <main className="app-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Clite / lexical analysis</p>
          <h1>Every character.<br /><em>One transition at a time.</em></h1>
          <p className="intro">Follow source code as it becomes a stream of tokens. No parser, no hidden steps.</p>
        </div>
        <span className={`status-badge ${session.complete ? 'is-complete' : ''}`} data-testid="playback-status">{status}</span>
      </header>

      <section className="toolbar" aria-label="Lexer controls">
        <div className="playback-controls">
          <button className="primary" disabled={session.complete || session.running} onClick={() => {
            setSelectedSpan(null);
            dispatch({ type: 'step' });
          }}>Step →</button>
          <button disabled={session.complete} onClick={() => dispatch({ type: session.running ? 'pause' : 'play' })}>{session.running ? 'Pause' : 'Run'}</button>
          <button onClick={() => {
            fileRevision.current += 1;
            setSelectedSpan(null);
            dispatch({ type: 'reset' });
          }}>Reset</button>
        </div>
        <label className="speed-control">Playback
          <select value={delay} onChange={(event) => setDelay(Number(event.target.value))}>
            <option value={200}>Slow · 5 steps/s</option>
            <option value={60}>Normal · 17 steps/s</option>
            <option value={10}>Fast · 100 steps/s</option>
          </select>
        </label>
      </section>

      <div className="workspace">
        <div className="source-column">
          <section className="panel editor-panel" aria-labelledby="source-heading">
            <div className="panel-heading">
              <h2 id="source-heading">Source input</h2>
              <div className="source-actions">
                <button onClick={() => replaceSource(sample)}>Load example</button>
                <label className="file-button">Open file
                  <input type="file" accept=".clite,.txt,text/plain" aria-label="Open source file" onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) void loadFile(file);
                    event.target.value = '';
                  }} />
                </label>
              </div>
            </div>
            <label className="sr-only" htmlFor="source-input">Source code</label>
            <textarea id="source-input" value={session.source} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => replaceSource(event.target.value)} aria-describedby="editor-hint" />
            <p className="panel-note" id="editor-hint">Editing starts a new execution. The example follows the documented grammar assumptions.</p>
            {fileError && <p className="file-error" role="alert">{fileError}</p>}
          </section>

          <section className="panel trace-panel">
            <SourceView source={session.source} position={session.lexer.position} span={highlightedSpan} />
          </section>
        </div>

        <div className="output-column">
          <LexerState state={session.lexer} event={session.event} source={session.source} steps={session.steps} />
          <TokenTable tokens={session.tokens} selectedSpan={selectedSpan} onSelect={(span) => {
            dispatch({ type: 'pause' });
            setSelectedSpan(span);
          }} />
          <section className="panel diagnostics-panel" aria-labelledby="diagnostics-heading">
            <div className="panel-heading"><h2 id="diagnostics-heading">Diagnostics</h2><span>{session.diagnostics.length} {session.diagnostics.length === 1 ? 'error' : 'errors'}</span></div>
            {session.diagnostics.length === 0 ? <p className="empty-state">{session.complete ? 'No lexical errors.' : 'No lexical errors so far.'}</p> : (
              <ul aria-live="polite">
                {session.diagnostics.map((diagnostic, index) => (
                  <li key={index}>
                    <button className="diagnostic-link" onClick={() => {
                      dispatch({ type: 'pause' });
                      setSelectedSpan(diagnostic.span);
                    }}>{diagnostic.span.start.line}:{diagnostic.span.start.column}</button>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <footer>Strict Clite · ASCII identifiers & characters · No comments or escapes · All processing stays in your browser</footer>
    </main>
  );
}
