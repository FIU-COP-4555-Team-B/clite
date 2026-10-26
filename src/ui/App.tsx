import { useEffect, useReducer, useState } from 'react';
import { createLexerState, step } from '../lexer/lexer';
import type { Diagnostic, LexerState as State, Span, Token, Transition } from '../lexer/types';
import { LexerState } from './LexerState';
import { SourceView } from './SourceView';
import { TokenTable } from './TokenTable';

const samples = Object.entries(import.meta.glob<string>('../../samples/**/*.clite', {
  eager: true,
  query: '?raw',
  import: 'default',
}))
  .map(([path, source]) => ({ name: path.slice('../../samples/'.length), source }))
  .sort((left, right) => left.name.localeCompare(right.name));

const initialSource = samples.find((sample) => sample.name === 'full-scope.clite')?.source ?? samples[0]?.source ?? '';

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

type SourceTab = 'edit' | 'preview';

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
  const [session, dispatch] = useReducer(reduceSession, initialSource, createSession);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [sourceTab, setSourceTab] = useState<SourceTab>('edit');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    if (!session.running) return;

    const timer = window.setInterval(() => {
      setSelectedSpan(null);
      dispatch({ type: 'step' });
    }, 200 / speed);

    return () => window.clearInterval(timer);
  }, [session.running, speed]);

  function replaceSource(source: string) {
    setSelectedSpan(null);
    setSourceTab('edit');
    dispatch({ type: 'source', source });
  }

  function inspectSpan(span: Span) {
    dispatch({ type: 'pause' });
    setSelectedSpan(span);
    setSourceTab('preview');
  }

  const status = session.complete ? 'Complete' : session.running ? 'Running' : session.steps > 0 ? 'Paused' : 'Ready';
  const highlightedSpan = selectedSpan ?? session.event?.span ?? null;

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Lexer controls">
        <h1>Clite</h1>
        <div className="playback-controls">
          <button className="primary" disabled={session.complete || session.running} onClick={() => {
            setSelectedSpan(null);
            setSourceTab('preview');
            dispatch({ type: 'step' });
          }}>Step →</button>
          <button disabled={session.complete} onClick={() => {
            if (!session.running) setSourceTab('preview');
            dispatch({ type: session.running ? 'pause' : 'play' });
          }}>{session.running ? 'Pause' : 'Run'}</button>
          <button className="speed-button" title="simulation speed" aria-label={`Simulation speed: ${speed}x`} onClick={() => {
            setSpeed((current) => current === 1 ? 2 : current === 2 ? 4 : 1);
          }}>{speed}x</button>
          <button onClick={() => {
            setSelectedSpan(null);
            dispatch({ type: 'reset' });
          }}>Reset</button>
        </div>
        <span className="status-badge" data-testid="playback-status">{status}</span>
      </header>

      <div className="workspace">
        <section className="panel source-panel" aria-labelledby="source-heading">
          <div className="panel-heading">
            <h2 id="source-heading">Source</h2>
            <div className="source-actions">
              <select aria-label="Load sample" value="" disabled={samples.length === 0} onChange={(event) => {
                const sample = samples.find((sample) => sample.name === event.target.value);

                if (sample) replaceSource(sample.source);
              }}>
                <option value="" disabled>Load sample</option>
                {samples.map((sample) => <option key={sample.name} value={sample.name}>{sample.name}</option>)}
              </select>
            </div>
          </div>
          <div className="source-tabs" role="tablist" aria-label="Source view" onKeyDown={(event) => {
            const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

            if (!keys.includes(event.key)) return;

            event.preventDefault();

            const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : sourceTab === 'edit' ? 1 : 0;
            const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');

            setSourceTab(index === 0 ? 'edit' : 'preview');
            tabs[index]?.focus();
          }}>
            <button id="edit-tab" role="tab" aria-selected={sourceTab === 'edit'} aria-controls="edit-panel" tabIndex={sourceTab === 'edit' ? 0 : -1} onClick={() => setSourceTab('edit')}>Edit</button>
            <button id="preview-tab" role="tab" aria-selected={sourceTab === 'preview'} aria-controls="preview-panel" tabIndex={sourceTab === 'preview' ? 0 : -1} onClick={() => setSourceTab('preview')}>Preview</button>
          </div>
          <div id="edit-panel" className="source-tab-panel" role="tabpanel" aria-labelledby="edit-tab" hidden={sourceTab !== 'edit'}>
            <label className="sr-only" htmlFor="source-input">Source code</label>
            <textarea id="source-input" value={session.source} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => replaceSource(event.target.value)} />
          </div>
          <div id="preview-panel" className="source-tab-panel" role="tabpanel" aria-labelledby="preview-tab" hidden={sourceTab !== 'preview'}>
            {sourceTab === 'preview' && <SourceView source={session.source} position={session.lexer.position} span={highlightedSpan} />}
          </div>
        </section>

        <LexerState state={session.lexer} event={session.event} source={session.source} steps={session.steps} />
        <TokenTable tokens={session.tokens} selectedSpan={selectedSpan} onSelect={inspectSpan} />
        <section className="panel diagnostics-panel" aria-labelledby="diagnostics-heading">
          <div className="panel-heading"><h2 id="diagnostics-heading">Diagnostics</h2><span>{session.diagnostics.length} {session.diagnostics.length === 1 ? 'error' : 'errors'}</span></div>
          {session.diagnostics.length === 0 ? <p className="empty-state">None</p> : (
            <ul aria-live="polite">
              {session.diagnostics.map((diagnostic, index) => (
                <li key={index}>
                  <button className="diagnostic-link" onClick={() => inspectSpan(diagnostic.span)}>{diagnostic.span.start.line}:{diagnostic.span.start.column}</button>
                  <span>{diagnostic.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
