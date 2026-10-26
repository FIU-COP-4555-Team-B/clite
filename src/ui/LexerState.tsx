import type { LexerState as State, Transition } from "../lexer/types";

interface LexerStateProps {
  state: State;
  event: Transition | null;
  source: string;
  steps: number;
}

export function LexerState({ state, event, source, steps }: LexerStateProps) {
  const next = source.codePointAt(state.position.offset);

  return (
    <section className="panel state-panel" aria-labelledby="state-heading">
      <div className="panel-heading">
        <h2 id="state-heading">Inside the lexer</h2>
        <span>
          {steps} {steps === 1 ? "transition" : "transitions"}
        </span>
      </div>
      <dl className="state-grid">
        <div>
          <dt>Recognition state</dt>
          <dd data-testid="recognition-state">{state.mode}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {state.position.line}:{state.position.column}{" "}
            <small>· offset {state.position.offset}</small>
          </dd>
        </div>
        <div>
          <dt>Partial lexeme</dt>
          <dd>
            <code>{JSON.stringify(state.lexeme)}</code>
          </dd>
        </div>
        <div>
          <dt>Lookahead</dt>
          <dd>
            <code>
              {next === undefined
                ? "EOF"
                : JSON.stringify(String.fromCodePoint(next))}
            </code>
          </dd>
        </div>
      </dl>
      <div className="transition" role="status" aria-live="polite">
        <span className="event-kind">{event?.kind ?? "ready"}</span>
        <p>{event?.message ?? "—"}</p>
      </div>
    </section>
  );
}
