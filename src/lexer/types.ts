export interface Position {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface Span {
  readonly start: Position;
  readonly end: Position;
}

export type TokenKind =
  | 'int'
  | 'bool'
  | 'float'
  | 'char'
  | 'main'
  | 'if'
  | 'else'
  | 'while'
  | 'boolean'
  | 'identifier'
  | 'integer'
  | 'float-literal'
  | 'char-literal'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '!'
  | '='
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||'
  | '('
  | ')'
  | '{'
  | '}'
  | '['
  | ']'
  | ','
  | ';'
  | 'eof';

export interface Token {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly span: Span;
}

export interface Diagnostic {
  readonly message: string;
  readonly span: Span;
}

export type LexerMode =
  | 'start'
  | 'identifier'
  | 'integer'
  | 'float'
  | 'symbol'
  | 'character-value'
  | 'character-close'
  | 'character-end'
  | 'character-invalid'
  | 'character-error'
  | 'invalid'
  | 'done';

export interface LexerState {
  readonly mode: LexerMode;
  readonly position: Position;
  readonly start: Position;
  readonly lexeme: string;
}

export type Transition =
  | { readonly kind: 'consume'; readonly span: Span; readonly message: string; }
  | {
      readonly kind: 'emit';
      readonly span: Span;
      readonly message: string;
      readonly token: Token;
    }
  | {
      readonly kind: 'error';
      readonly span: Span;
      readonly message: string;
      readonly diagnostic: Diagnostic;
    }
  | {
      readonly kind: 'finish';
      readonly span: Span;
      readonly message: string;
      readonly token: Token;
    };

export interface StepResult {
  readonly state: LexerState;
  readonly event: Transition;
}
