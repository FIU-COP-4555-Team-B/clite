import { describe, expect, it } from 'vitest';
import sample from '../../samples/full-scope.clite?raw';
import expected from '../../samples/full-scope.tokens.json';
import { createLexerState, step, tokenize } from './lexer';
import type { Token } from './types';

describe('full-scope sample', () => {
  it('matches the hand-authored token sequence without diagnostics', () => {
    const result = tokenize(sample);

    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map(({ kind, lexeme }) => [kind, lexeme])).toEqual(expected);

    for (const token of result.tokens) {
      expect(sample.slice(token.span.start.offset, token.span.end.offset)).toBe(token.lexeme);
    }
  });

  it('produces the same sample output by stepping one transition at a time', () => {
    let state = createLexerState();
    const tokens: Token[] = [];
    let complete = false;

    for (let count = 0; count < sample.length * 4 + 10; count += 1) {
      const result = step(sample, state);

      state = result.state;

      if (result.event.kind === 'emit' || result.event.kind === 'finish') tokens.push(result.event.token);

      expect(result.event.kind).not.toBe('error');

      if (result.event.kind === 'finish') {
        complete = true;
        break;
      }
    }

    expect(complete).toBe(true);
    expect(tokens).toEqual(tokenize(sample).tokens);
  });

  it('exercises every token kind', () => {
    const kinds = new Set(tokenize(sample).tokens.map((token) => token.kind));

    expect([...kinds].sort()).toEqual([
      'int', 'bool', 'float', 'char', 'main', 'if', 'else', 'while',
      'identifier', 'integer', 'boolean', 'float-literal', 'char-literal',
      '+', '-', '*', '/', '%', '!', '=', '==', '!=', '<', '<=', '>', '>=', '&&', '||',
      '(', ')', '{', '}', '[', ']', ',', ';', 'eof',
    ].sort());
  });
});
