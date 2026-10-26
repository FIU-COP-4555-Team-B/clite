# Clite lexer lab

A dependency-free TypeScript lexer with a React interface for stepping through
lexical analysis. The language specification lives in [`pdf/writeup.typ`](pdf/writeup.typ).

## Run

Use Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Check and build

```bash
npm test
npm run typecheck
npm run build
```

`npm run test:watch` runs tests interactively.
`npm run preview` serves the production build from `dist/`.

## Language contract

The lexer recognizes tokens, not valid programs: it does not check declarations,
statement structure, types, or precedence. The grammar requires each declaration
to end with `;`, including declarations with multiple identifiers or arrays.

| Category         | Accepted spelling                                       |
| ---------------- | ------------------------------------------------------- |
| Keywords         | `int bool float char main if else while`                |
| Boolean literals | `true false`                                            |
| Identifiers      | ASCII letter followed by zero or more letters or digits |
| Integers         | One or more decimal digits                              |
| Floats           | One or more digits, `.`, one or more digits             |
| Characters       | A single ASCII character between single quotes          |
| Operators        | `+ - * / % ! = == != < <= > >= && \|\|`                 |
| Delimiters       | `( ) { } [ ] , ;`                                       |
| Whitespace       | Space, tab, LF, CR, vertical tab, form feed             |

Recognition is case-sensitive and uses the longest valid token. For example,
`if2` is one identifier, `<=` is one operator, and `-12` is an operator followed
by an integer. Leading zeros are allowed. Floats have no exponent notation.
There are no comments, identifier underscores, string literals, or escape
sequences. For example, `//` is two division tokens, not a comment. `1.`
produces an integer token followed by a diagnostic for `.`.

The character rule follows the full ASCII range in the grammar, including
control characters. A backslash is an ordinary character, not an escape prefix.
Three consecutive single quotes represent the ASCII apostrophe character. Tests
generate all 128 ASCII character literals; the bundled example uses readable
characters.

### Grammar assumptions

The writeup leaves several rules incomplete. This project uses these
interpretations without rewriting the specification:

- **Type names:** `Integer`, `Boolean`, `Float`, and `Char` in type positions
  mean `int`, `bool`, `float`, and `char`.
- **Addition operators:** The undefined `AddOp` means `+` or `-`.
- **Blocks:** The undefined `Block` means `{ Statements }`.
- **Entry point:** `main` is a reserved keyword because the program production
  fixes its spelling.

Lexical errors have source spans, and scanning continues after malformed input.
Malformed character literals skip through the next closing apostrophe or the
end of input. Other lexical errors skip one code point. The lexer does not
diagnose syntactically invalid sequences of otherwise valid tokens.

## Lexer API

```ts
import { createLexerState, step, tokenize } from "./src/lexer/lexer";

const result = tokenize("int main() {}");

const initial = createLexerState();
const transition = step("int main() {}", initial);
```

`tokenize` returns tokens and diagnostics, including a final `eof` token. `step`
returns a new immutable state and one event: `consume`, `emit`, `error`, or
`finish`. A transition consumes at most one character or changes recognition
state without consuming the next character. Token emission does not consume the
next token's first character. Stop driving the lexer after `finish`; create a
fresh state whenever the source changes.

Spans have an inclusive start and exclusive end. Offsets count UTF-16 code
units, matching JavaScript string slicing. Lines and columns start at 1; CRLF
counts as one line break. Columns count code points; a tab counts as one column
rather than its visual width. Tokens preserve source spellings rather than
converting numbers to JavaScript numeric values.

## Structure and coverage

`src/lexer/` contains the pure lexer, its types, and its tests.
`src/ui/` contains React presentation and playback controls.
The lexer has no React, browser, or third-party runtime dependencies.

[`samples/full-scope.clite`](samples/full-scope.clite) covers every token kind
and the grammar's constructs under the assumptions above.
[`samples/full-scope.tokens.json`](samples/full-scope.tokens.json) contains the
hand-authored expected sequence as `[kind, lexeme]` pairs. Tests compare the
fixture against that sequence and check that stepping matches batch
tokenization. Unit tests cover boundaries, malformed inputs, positions,
character literals, and termination. UI tests cover fixed playback timing,
source tabs and keyboard navigation, editing, reset, sample discovery and
reloading, token inspection, and error display.

To build the grammar PDF separately, install Typst and run:

```bash
typst compile pdf/writeup.typ
```
