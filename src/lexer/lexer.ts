import type {
  Diagnostic,
  LexerMode,
  LexerState,
  Position,
  StepResult,
  Token,
  TokenKind,
} from './types';

const keywords = new Map<string, TokenKind>([
  ['int', 'int'],
  ['bool', 'bool'],
  ['float', 'float'],
  ['char', 'char'],
  ['main', 'main'],
  ['if', 'if'],
  ['else', 'else'],
  ['while', 'while'],
  ['true', 'boolean'],
  ['false', 'boolean'],
]);

const symbols = new Map<string, TokenKind>([
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['/', '/'],
  ['%', '%'],
  ['!', '!'],
  ['=', '='],
  ['==', '=='],
  ['!=', '!='],
  ['<', '<'],
  ['<=', '<='],
  ['>', '>'],
  ['>=', '>='],
  ['&&', '&&'],
  ['||', '||'],
  ['(', '('],
  [')', ')'],
  ['{', '{'],
  ['}', '}'],
  ['[', '['],
  [']', ']'],
  [',', ','],
  [';', ';'],
]);

const whitespace = new Set([' ', '\t', '\n', '\r', '\v', '\f']);

function isLetter(character: string): boolean {
  return (
    (character >= 'a' && character <= 'z') ||
    (character >= 'A' && character <= 'Z')
  );
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function characterAt(source: string, offset: number): string {
  const codePoint = source.codePointAt(offset);

  return codePoint === undefined ? '' : String.fromCodePoint(codePoint);
}

function advance(source: string, position: Position, character: string): Position {
  const offset = position.offset + character.length;

  if (character === '\r') {
    return { offset, line: position.line + 1, column: 1 };
  }

  if (character === '\n') {
    const followsCarriageReturn = source[position.offset - 1] === '\r';

    return {
      offset,
      line: position.line + (followsCarriageReturn ? 0 : 1),
      column: 1,
    };
  }

  return { offset, line: position.line, column: position.column + 1 };
}

function reset(position: Position, mode: 'start' | 'done' = 'start'): LexerState {
  return { mode, position, start: position, lexeme: '' };
}

export function createLexerState(): LexerState {
  return reset({ offset: 0, line: 1, column: 1 });
}

function consume(
  source: string,
  state: LexerState,
  character: string,
  mode: LexerMode,
): StepResult {
  const position = advance(source, state.position, character);
  const nextState: LexerState =
    mode === 'start'
      ? reset(position)
      : { ...state, mode, position, lexeme: state.lexeme + character };

  return {
    state: nextState,
    event: {
      kind: 'consume',
      span: { start: state.position, end: position },
      message: `Consume ${JSON.stringify(character)}; enter ${mode} mode.`,
    },
  };
}

function emit(state: LexerState, kind: TokenKind): StepResult {
  const span = { start: state.start, end: state.position };
  const token: Token = { kind, lexeme: state.lexeme, span };

  return {
    state: reset(state.position),
    event: { kind: 'emit', span, message: `Emit ${kind}.`, token },
  };
}

function fail(state: LexerState, message: string): StepResult {
  const span = { start: state.start, end: state.position };
  const diagnostic: Diagnostic = { message, span };

  return {
    state: reset(state.position),
    event: { kind: 'error', span, message, diagnostic },
  };
}

function finish(state: LexerState): StepResult {
  const span = { start: state.position, end: state.position };
  const token: Token = { kind: 'eof', lexeme: '', span };

  return {
    state: state.mode === 'done' ? state : reset(state.position, 'done'),
    event: { kind: 'finish', span, message: 'End of input.', token },
  };
}

/** Consume one code point or emit one event without consuming lookahead. */
export function step(source: string, state: LexerState): StepResult {
  if (state.mode === 'done') return finish(state);

  const character = characterAt(source, state.position.offset);

  switch (state.mode) {
    case 'start': {
      if (character === '') return finish(state);
      if (whitespace.has(character)) return consume(source, state, character, 'start');

      const beginning = reset(state.position);

      if (isLetter(character)) return consume(source, beginning, character, 'identifier');
      if (isDigit(character)) return consume(source, beginning, character, 'integer');
      if (character === '\'') return consume(source, beginning, character, 'character-value');
      if (symbols.has(character) || character === '&' || character === '|') {
        return consume(source, beginning, character, 'symbol');
      }

      return consume(source, beginning, character, 'invalid');
    }

    case 'identifier':
      if (isLetter(character) || isDigit(character)) {
        return consume(source, state, character, 'identifier');
      }

      return emit(state, keywords.get(state.lexeme) ?? 'identifier');

    case 'integer':
      if (isDigit(character)) return consume(source, state, character, 'integer');
      if (character === '.' && isDigit(characterAt(source, state.position.offset + 1))) {
        return consume(source, state, character, 'float');
      }

      return emit(state, 'integer');

    case 'float':
      if (isDigit(character)) return consume(source, state, character, 'float');

      return emit(state, 'float-literal');

    case 'symbol': {
      const combined = state.lexeme + character;

      if (character !== '' && symbols.has(combined)) {
        return consume(source, state, character, 'symbol');
      }

      const kind = symbols.get(state.lexeme);

      return kind === undefined
        ? fail(state, `Isolated ${JSON.stringify(state.lexeme)} is invalid; use ${state.lexeme.repeat(2)}.`)
        : emit(state, kind);
    }

    case 'character-value':
      if (character === '') return fail(state, 'Unterminated character literal; reached end of input.');

      return consume(
        source,
        state,
        character,
        character.charCodeAt(0) <= 0x7f ? 'character-close' : 'character-invalid',
      );

    case 'character-close':
      if (character === '') return fail(state, 'Unterminated character literal; reached end of input.');

      return consume(source, state, character, character === '\'' ? 'character-end' : 'character-invalid');

    case 'character-invalid':
      if (character === '') {
        return fail(state, 'Invalid character literal: expected exactly one ASCII character; skipped to end of input.');
      }

      return consume(source, state, character, character === '\'' ? 'character-error' : 'character-invalid');

    case 'character-end':
      return emit(state, 'char-literal');

    case 'character-error':
      return fail(state, 'Invalid character literal: expected exactly one ASCII character; skipped through the closing apostrophe.');

    case 'invalid':
      return fail(state, `Unexpected character ${JSON.stringify(state.lexeme)}; skipped it.`);
  }
}

/** Malformed character literals recover at the next apostrophe or EOF; other errors skip one code point. */
export function tokenize(source: string): { tokens: Token[]; diagnostics: Diagnostic[]; } {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  let state = createLexerState();

  while (state.mode !== 'done') {
    const result = step(source, state);

    state = result.state;

    if (result.event.kind === 'emit' || result.event.kind === 'finish') {
      tokens.push(result.event.token);
    } else if (result.event.kind === 'error') {
      diagnostics.push(result.event.diagnostic);
    }
  }

  return { tokens, diagnostics };
}
