import { describe, expect, it } from 'vitest';
import { createLexerState, step, tokenize } from './lexer';
import type { Diagnostic, LexerMode, LexerState, Position, Token, TokenKind, Transition } from './types';

function compact(source: string): [TokenKind, string][] {
  return tokenize(source).tokens.map(({ kind, lexeme }) => [kind, lexeme]);
}

function position(offset: number, line = 1, column = offset + 1): Position {
  return { offset, line, column };
}

function trace(source: string): {
  tokens: Token[];
  diagnostics: Diagnostic[];
  events: Transition[];
  states: LexerState[];
} {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const events: Transition[] = [];
  const states = [createLexerState()];
  const bound = 3 * source.length + 2;

  let state = states[0]!;

  while (state.mode !== 'done') {
    expect(events.length).toBeLessThan(bound);

    const previous = state;
    const result = step(source, previous);

    state = result.state;
    events.push(result.event);
    states.push(state);

    if (result.event.kind === 'consume') {
      const consumed = source.slice(previous.position.offset, state.position.offset);

      expect([...consumed]).toHaveLength(1);
      expect(result.event.span).toEqual({ start: previous.position, end: state.position });
    } else {
      expect(state.position).toEqual(previous.position);
    }

    if (result.event.kind === 'emit' || result.event.kind === 'finish') {
      tokens.push(result.event.token);
      expect(result.event.token.span).toEqual(result.event.span);
    } else if (result.event.kind === 'error') {
      diagnostics.push(result.event.diagnostic);
      expect(result.event.diagnostic.span).toEqual(result.event.span);
    }
  }

  expect(events.at(-1)?.kind).toBe('finish');
  expect(tokens.filter((token) => token.kind === 'eof')).toHaveLength(1);
  expect(state.position.offset).toBe(source.length);

  return { tokens, diagnostics, events, states };
}

describe('token categories', () => {
  it('starts at offset zero and line/column one', () => {
    expect(createLexerState()).toEqual({
      mode: 'start',
      position: position(0),
      start: position(0),
      lexeme: '',
    });
  });

  it('emits exactly one EOF for empty input', () => {
    expect(tokenize('')).toEqual({
      tokens: [{ kind: 'eof', lexeme: '', span: { start: position(0), end: position(0) } }],
      diagnostics: [],
    });
  });

  it('recognizes each keyword and both boolean literals', () => {
    expect(compact('int bool float char main if else while true false')).toEqual([
      ['int', 'int'],
      ['bool', 'bool'],
      ['float', 'float'],
      ['char', 'char'],
      ['main', 'main'],
      ['if', 'if'],
      ['else', 'else'],
      ['while', 'while'],
      ['boolean', 'true'],
      ['boolean', 'false'],
      ['eof', ''],
    ]);
  });

  it.each(['int', 'bool', 'float', 'char', 'main', 'if', 'else', 'while', 'true', 'false'])(
    'does not match %s inside a longer identifier',
    (keyword) => {
      const identifiers = [`${keyword}x`, `${keyword}0`, `x${keyword}`, keyword.toUpperCase()];

      expect(compact(identifiers.join(' '))).toEqual([
        ...identifiers.map((lexeme) => ['identifier', lexeme]),
        ['eof', ''],
      ]);
    },
  );

  it('accepts all ASCII letters and digits after a leading letter', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const source = `${letters}0123456789 Z a0 a1B2`;

    expect(compact(source)).toEqual([
      ['identifier', `${letters}0123456789`],
      ['identifier', 'Z'],
      ['identifier', 'a0'],
      ['identifier', 'a1B2'],
      ['eof', ''],
    ]);
  });

  it('keeps digit prefixes separate from identifiers', () => {
    expect(compact('123abc 0true 12.34x')).toEqual([
      ['integer', '123'],
      ['identifier', 'abc'],
      ['integer', '0'],
      ['boolean', 'true'],
      ['float-literal', '12.34'],
      ['identifier', 'x'],
      ['eof', ''],
    ]);
  });

  it('keeps signs separate and accepts leading zeroes without numeric conversion', () => {
    const large = '9'.repeat(400);

    expect(compact(`+0 -123 000 000.001 ${large}`)).toEqual([
      ['+', '+'],
      ['integer', '0'],
      ['-', '-'],
      ['integer', '123'],
      ['integer', '000'],
      ['float-literal', '000.001'],
      ['integer', large],
      ['eof', ''],
    ]);
  });

  it('recognizes every operator and delimiter', () => {
    const spellings: TokenKind[] = [
      '+', '-', '*', '/', '%', '!', '=', '==', '!=', '<', '<=', '>', '>=', '&&', '||',
      '(', ')', '{', '}', '[', ']', ',', ';',
    ];

    expect(compact(spellings.join(' '))).toEqual([
      ...spellings.map((spelling) => [spelling, spelling]),
      ['eof', ''],
    ]);
    expect(tokenize(spellings.join(' ')).diagnostics).toEqual([]);
  });

  it('does not treat comment-like text or escapes as special syntax', () => {
    expect(compact('// hi /* x */')).toEqual([
      ['/', '/'], ['/', '/'], ['identifier', 'hi'], ['/', '/'], ['*', '*'],
      ['identifier', 'x'], ['*', '*'], ['/', '/'], ['eof', ''],
    ]);
    expect(compact('\'\\\'')).toEqual([['char-literal', '\'\\\''], ['eof', '']]);
    expect(tokenize('\'\\n\'').diagnostics).toHaveLength(1);
  });

  it('handles an entire grammar-shaped program without parsing it', () => {
    const source = 'int main(){bool b;float f;char c;int a[2],i;i=0;f=12.5;c=\'x\';b=true&&false;while(i<2){if(!b)a[i]=i%2;else a[i]=-i;i=i+1;}}';
    const result = tokenize(source);

    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map((token) => token.lexeme).join('')).toBe(source.replaceAll(' ', ''));
    expect(result.tokens.at(-1)?.kind).toBe('eof');
  });
});

describe('longest match and lookahead', () => {
  it.each([
    ['===', ['==', '=']],
    ['!==', ['!=', '=']],
    ['!!=', ['!', '!=']],
    ['<==', ['<=', '=']],
    ['>==', ['>=', '=']],
    ['<<>>', ['<', '<', '>', '>']],
    ['&&&&||||', ['&&', '&&', '||', '||']],
    ['+-*/%', ['+', '-', '*', '/', '%']],
    ['(){}[],;', ['(', ')', '{', '}', '[', ']', ',', ';']],
  ])('uses maximal valid operators in %s', (source, expected) => {
    expect(tokenize(source).tokens.slice(0, -1).map((token) => token.kind)).toEqual(expected);
    expect(tokenize(source).diagnostics).toEqual([]);
  });

  it.each([
    ['0.0', [['float-literal', '0.0']], 0],
    ['12.345', [['float-literal', '12.345']], 0],
    ['1.', [['integer', '1']], 1],
    ['.5', [['integer', '5']], 1],
    ['1..2', [['integer', '1'], ['integer', '2']], 2],
    ['1.2.3', [['float-literal', '1.2'], ['integer', '3']], 1],
    ['1.2.', [['float-literal', '1.2']], 1],
    ['1. 2', [['integer', '1'], ['integer', '2']], 1],
    ['1e2', [['integer', '1'], ['identifier', 'e2']], 0],
    ['0x10', [['integer', '0'], ['identifier', 'x10']], 0],
    ['2.0e+3', [['float-literal', '2.0'], ['identifier', 'e'], ['+', '+'], ['integer', '3']], 0],
  ])('requires decimal digits on both sides of the dot in %s', (source, expected, errors) => {
    expect(compact(source)).toEqual([...expected, ['eof', '']]);
    expect(tokenize(source).diagnostics).toHaveLength(errors);
  });

  it('emits an identifier without consuming the following operator', () => {
    const first = step('a+b', createLexerState());
    const second = step('a+b', first.state);

    expect(first.event.kind).toBe('consume');
    expect(first.state.lexeme).toBe('a');
    expect(second.event.kind).toBe('emit');
    expect(second.state.position).toEqual(position(1));
    expect(step('a+b', second.state).state.lexeme).toBe('+');
    expect(compact('a+b')).toEqual([
      ['identifier', 'a'], ['+', '+'], ['identifier', 'b'], ['eof', ''],
    ]);
  });

  it('leaves an invalid decimal dot for a later error transition', () => {
    const first = step('1.', createLexerState());
    const second = step('1.', first.state);
    const third = step('1.', second.state);
    const fourth = step('1.', third.state);

    expect(second.event.kind).toBe('emit');
    expect(second.state.position.offset).toBe(1);
    expect(third.event.kind).toBe('consume');
    expect(third.state.lexeme).toBe('.');
    expect(fourth.event.kind).toBe('error');
    expect(fourth.state.position.offset).toBe(2);
  });
});

describe('character literals', () => {
  it.each(Array.from({ length: 128 }, (_, value) => value))(
    'accepts exactly ASCII code %i as literal content',
    (value) => {
      const source = `'${String.fromCharCode(value)}'`;
      const result = tokenize(source);

      expect(result.diagnostics).toEqual([]);
      expect(result.tokens[0]).toMatchObject({ kind: 'char-literal', lexeme: source });
      expect(result.tokens[0]?.span.start).toEqual(position(0));
      expect(result.tokens[0]?.span.end.offset).toBe(3);
      expect(result.tokens).toHaveLength(2);
      expect(trace(source).tokens).toEqual(result.tokens);
    },
  );

  it('accepts an apostrophe, NUL, newline, and backslash without escapes', () => {
    const literals = ['\'\'\'', '\'\0\'', '\'\n\'', '\'\\\''];

    expect(compact(literals.join(' '))).toEqual([
      ...literals.map((literal) => ['char-literal', literal]),
      ['eof', ''],
    ]);
  });

  it.each(['\'', '\'\'', '\'a', '\'ab', '\'🙂', '\'\r\n'])(
    'reports one diagnostic for incomplete or invalid literal %j',
    (source) => {
      const result = tokenize(source);

      expect(result.tokens.map((token) => token.kind)).toEqual(['eof']);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.span).toEqual({
        start: position(0),
        end: result.tokens[0]?.span.end,
      });
      expect(result.diagnostics[0]?.message).toMatch(/end of input/);
    },
  );

  it.each(['\'ab\'', '\'é\'', '\'🙂\'', '\'\r\n\'', '\'\\n\'', '\'a b\''])(
    'skips malformed %j through its closing apostrophe and resumes',
    (literal) => {
      const result = tokenize(`${literal};int x`);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toMatch(/exactly one ASCII character.*closing apostrophe/);
      expect(result.diagnostics[0]?.span.start.offset).toBe(0);
      expect(result.diagnostics[0]?.span.end.offset).toBe(literal.length);
      expect(result.tokens.map(({ kind }) => kind)).toEqual([';', 'int', 'identifier', 'eof']);
    },
  );

  it('treats an empty-looking pair as an apostrophe value missing its closing quote', () => {
    expect(tokenize('\'\'').diagnostics[0]?.message).toMatch(/Unterminated/);
    expect(tokenize('\'\'\'').diagnostics).toEqual([]);
  });

  it('does not stop malformed-literal recovery at a newline or semicolon', () => {
    const source = '\'ab\n;int x\' bool';
    const result = tokenize(source);

    expect(result.diagnostics).toHaveLength(1);
    expect(compact(source)).toEqual([['bool', 'bool'], ['eof', '']]);
    expect(result.diagnostics[0]?.span.end).toEqual(position(11, 2, 8));
  });
});

describe('diagnostics and recovery', () => {
  it.each(['&', '|'])('rejects isolated %s without dropping adjacent tokens', (character) => {
    const result = tokenize(`a${character}b${character}`);

    expect(result.tokens.map((token) => token.lexeme)).toEqual(['a', 'b', '']);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]?.message).toContain(character.repeat(2));
    expect(result.diagnostics[0]?.span).toEqual({ start: position(1), end: position(2) });
    expect(result.diagnostics[1]?.span).toEqual({ start: position(3), end: position(4) });
  });

  it('recognizes pairs before diagnosing a remaining ampersand or bar', () => {
    const result = tokenize('&&&|||');

    expect(compact('&&&|||')).toEqual([['&&', '&&'], ['||', '||'], ['eof', '']]);
    expect(result.diagnostics.map(({ span }) => [span.start.offset, span.end.offset])).toEqual([
      [2, 3], [5, 6],
    ]);
  });

  it.each(['.', '_', '$', ':', '"', '\\', '\0', '\x7f', '\u00a0', 'é', '中', '🙂', '\ud800'])(
    'skips invalid character %j and resumes lexing',
    (character) => {
      const result = tokenize(`a${character}b`);

      expect(compact(`a${character}b`)).toEqual([
        ['identifier', 'a'], ['identifier', 'b'], ['eof', ''],
      ]);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toMatch(/Unexpected character.*skipped it/);
      expect(result.diagnostics[0]?.span).toEqual({
        start: position(1),
        end: position(1 + character.length, 1, 3),
      });
    },
  );

  it('allows only the six explicit ASCII whitespace characters', () => {
    expect(compact(' \t\n\r\v\f')).toEqual([['eof', '']]);
    expect(tokenize(' \t\n\r\v\f').diagnostics).toEqual([]);

    const unicodeWhitespace = '\u0085\u00a0\u1680\u2000\u2003\u2028\u2029\u202f\u205f\u3000\ufeff';

    expect(tokenize(unicodeWhitespace).diagnostics).toHaveLength([...unicodeWhitespace].length);
    expect(compact(unicodeWhitespace)).toEqual([['eof', '']]);
  });

  it('preserves token and diagnostic order with consecutive invalid input', () => {
    const result = tokenize('int _a = .5 & | @ true;');

    expect(result.tokens.map((token) => token.kind)).toEqual([
      'int', 'identifier', '=', 'integer', 'boolean', ';', 'eof',
    ]);
    expect(result.diagnostics.map(({ span }) => span.start.offset)).toEqual([4, 9, 12, 14, 16]);
  });
});

describe('positions and spans', () => {
  it('uses exclusive end positions and preserves original lexemes', () => {
    expect(tokenize('int a=12.50;').tokens).toEqual([
      { kind: 'int', lexeme: 'int', span: { start: position(0), end: position(3) } },
      { kind: 'identifier', lexeme: 'a', span: { start: position(4), end: position(5) } },
      { kind: '=', lexeme: '=', span: { start: position(5), end: position(6) } },
      { kind: 'float-literal', lexeme: '12.50', span: { start: position(6), end: position(11) } },
      { kind: ';', lexeme: ';', span: { start: position(11), end: position(12) } },
      { kind: 'eof', lexeme: '', span: { start: position(12), end: position(12) } },
    ]);
  });

  it('counts CRLF as one newline, standalone CR and LF as newlines, and tabs as one column', () => {
    const result = tokenize('a\r\nb\rc\nd\t e\v\ff');
    const starts = result.tokens.map(({ span }) => span.start);

    expect(result.diagnostics).toEqual([]);
    expect(starts).toEqual([
      position(0),
      position(3, 2, 1),
      position(5, 3, 1),
      position(7, 4, 1),
      position(10, 4, 4),
      position(13, 4, 7),
      position(14, 4, 8),
    ]);
  });

  it('keeps each CR and LF consumption separate without incrementing the line twice', () => {
    const result = trace('\r\n');

    expect(result.events.map(({ span }) => span.end)).toEqual([
      position(1, 2, 1), position(2, 2, 1), position(2, 2, 1),
    ]);
  });

  it('tracks LF and CR inside valid character literals', () => {
    const result = tokenize('\'\n\' \'\r\'x');

    expect(result.tokens.map(({ span }) => span)).toEqual([
      { start: position(0), end: position(3, 2, 2) },
      { start: position(4, 2, 3), end: position(7, 3, 2) },
      { start: position(7, 3, 2), end: position(8, 3, 3) },
      { start: position(8, 3, 3), end: position(8, 3, 3) },
    ]);
  });

  it('uses UTF-16 offsets but one column per unsupported Unicode code point', () => {
    const result = tokenize('a🙂b\r\n中c');

    expect(result.diagnostics.map(({ span }) => span)).toEqual([
      { start: position(1), end: position(3, 1, 3) },
      { start: position(6, 2, 1), end: position(7, 2, 2) },
    ]);
    expect(result.tokens.map(({ span }) => span.start)).toEqual([
      position(0), position(3, 1, 3), position(7, 2, 2), position(8, 2, 3),
    ]);
    expect(trace('🙂').events.filter(({ kind }) => kind === 'consume')).toHaveLength(1);
  });

  it('gives EOF its own zero-width span after trailing whitespace and errors', () => {
    const result = tokenize('x\r\n@ ');

    expect(result.tokens.at(-1)).toEqual({
      kind: 'eof',
      lexeme: '',
      span: { start: position(5, 2, 3), end: position(5, 2, 3) },
    });
  });
});

describe('functional stepping and termination', () => {
  it.each([
    ['', 'start'],
    ['abc', 'identifier'],
    ['12', 'integer'],
    ['1.2', 'float'],
    ['=', 'symbol'],
    ['&', 'symbol'],
    ['\'', 'character-value'],
    ['\'a', 'character-close'],
    ['\'a\'', 'character-end'],
    ['\'ab', 'character-invalid'],
    ['\'ab\'', 'character-error'],
    ['@', 'invalid'],
  ] satisfies [string, LexerMode][])(
    'flushes pending %s at EOF from %s mode',
    (source, mode) => {
      const result = trace(source);
      const atEnd = result.states.find((state) => state.position.offset === source.length && state.mode === mode);

      expect(atEnd).toBeDefined();
      expect({ tokens: result.tokens, diagnostics: result.diagnostics }).toEqual(tokenize(source));
      expect(result.tokens.at(-1)?.kind).toBe('eof');
    },
  );

  it('keeps a done state terminal and safe on repeated calls', () => {
    const finished = step('', createLexerState());

    expect(finished.state.mode).toBe('done');
    expect(step('', finished.state)).toEqual(finished);
    expect(step('different input', finished.state)).toEqual(finished);
    expect(step('', finished.state).state).toBe(finished.state);
  });

  it('does not mutate states or nested positions, and is deterministic', () => {
    const source = 'int x=1.2; \'\n\' & 🙂 \'ab\'';

    let state = createLexerState();

    for (let count = 0; state.mode !== 'done'; count += 1) {
      expect(count).toBeLessThan(3 * source.length + 2);

      const before = structuredClone(state);

      Object.freeze(state.position);
      Object.freeze(state.start);
      Object.freeze(state);

      const first = step(source, state);
      const second = step(source, state);

      expect(state).toEqual(before);
      expect(first).toEqual(second);

      state = first.state;
    }
  });

  it('does not share mutable state between independent lexers', () => {
    const left = createLexerState();
    const right = createLexerState();

    expect(left).not.toBe(right);
    expect(left.position).not.toBe(right.position);

    const advanced = step('abc', left);

    expect(right).toEqual(createLexerState());
    expect(step('12', right).state.lexeme).toBe('1');
    expect(advanced.state.lexeme).toBe('a');
  });

  it('reaches every mode using valid source-driven transitions', () => {
    const modes = new Set<LexerMode>();

    for (const source of ['', 'a', '1', '1.2', '+', '\'', '\'x', '\'x\'', '\'ab', '\'ab\'', '@']) {
      for (const state of trace(source).states) modes.add(state.mode);
    }

    expect([...modes].sort()).toEqual([
      'character-close', 'character-end', 'character-error', 'character-invalid', 'character-value',
      'done', 'float', 'identifier', 'integer', 'invalid', 'start', 'symbol',
    ]);
  });

  it('matches batch tokens and diagnostics on mixed source and partitions every consumed character', () => {
    const source = 'int main() {\r\n x=1.2.3; a&&b|c; \'🙂\' \'\n\' @\r\n}';
    const result = trace(source);
    const consumed = result.events
      .filter((event) => event.kind === 'consume')
      .map(({ span }) => source.slice(span.start.offset, span.end.offset))
      .join('');

    expect(consumed).toBe(source);
    expect({ tokens: result.tokens, diagnostics: result.diagnostics }).toEqual(tokenize(source));

    for (const token of result.tokens) {
      expect(source.slice(token.span.start.offset, token.span.end.offset)).toBe(token.lexeme);
    }
  });

  it('terminates within a linear bound on deterministic seeded strings', () => {
    const alphabet = [...'abcXYZ019 .\t\n\r\v\f_+-*/%!<>=&|(){}[],;\'\\', '\0', '\x7f', 'é', '🙂', '\ud800'];

    let seed = 0x5eed1234;

    for (let sample = 0; sample < 200; sample += 1) {
      let source = '';

      for (let index = 0; index < sample % 80; index += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        source += alphabet[seed % alphabet.length];
      }

      const result = trace(source);

      expect({ tokens: result.tokens, diagnostics: result.diagnostics }).toEqual(tokenize(source));

      for (const { span } of [...result.tokens, ...result.diagnostics]) {
        expect(span.start.offset).toBeLessThanOrEqual(span.end.offset);
        expect(span.start.offset).toBeGreaterThanOrEqual(0);
        expect(span.end.offset).toBeLessThanOrEqual(source.length);
      }
    }
  });
});
