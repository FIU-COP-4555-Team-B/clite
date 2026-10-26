#import "@preview/fletcher:0.5.8" as fletcher: diagram, edge, node

#let title = [Clite Lexer]
#let class-code = [COP 4555: Principles of Programming Languages]
#let authors = ("Gabriel Garcia", "Marcelo Hernandez", "Shirina Daniel")
#let date = datetime.today()

#set document(title: title, author: authors, date: date)
#set page(paper: "us-letter", margin: (x: 0.7in, y: 0.5in))
#set text(font: "Libertinus Serif", size: 10pt)

#align(center, stack(
  spacing: 0.8em,
  text(size: 16pt, title),
  class-code,
  grid(columns: authors.len(), column-gutter: 2em, ..authors),
  date.display("[month repr:long] [day padding:none], [year]"),
))

#align(center, text(size: 16pt, weight: "bold")[Contents])
#outline(title: none, depth: 2)

#pagebreak()

= Lexer

The lexer is a state machine. Its state holds a mode, a position, and the partial lexeme.
Each call to `step` reads the next character, the lookahead, and does one of these actions:

- It consumes the lookahead and goes to a mode.
- It emits a token or a diagnostic and goes back to the `start` mode. It does not consume the lookahead.

`tokenize` calls `step` until `step` emits the `eof` token.

#let action(pos, body) = node(pos, body, stroke: luma(120), corner-radius: 2pt)
#let mode(pos, name, ..args) = node(pos, raw(name), fill: rgb("#E3F2FD"), stroke: rgb("#1565C0"), corner-radius: 2pt, ..args)
#let test(pos, body) = node(pos, body, shape: fletcher.shapes.diamond.with(fit: 0.2), fill: rgb("#FFF8E1"), stroke: rgb("#F9A825"))
#let emit(pos, body) = node(pos, body, fill: rgb("#E8F5E9"), stroke: rgb("#2E7D32"), corner-radius: 2pt)
#let report(pos, body) = node(pos, body, fill: rgb("#FFEBEE"), stroke: rgb("#C62828"), corner-radius: 2pt)
#let terminal(pos, body) = node(pos, body, shape: fletcher.shapes.pill, fill: luma(235), stroke: luma(120))
// Show one source character. Make it larger than inline raw text so that `'` and `.` are easy to read.
#let char(c) = text(size: 1.8em, raw(c))

#figure(
  {
    set text(size: 8pt)
    diagram(
      spacing: (2.4em, 1.6em),
      node-inset: 5pt,
      edge-stroke: 0.7pt,
      mark-scale: 80%,

      terminal((0, 0), [Source text]),
      action((0, 1), [Set the mode to `start`. \ Go to line 1, column 1.]),
      action((0, 2), [Read the lookahead]),
      edge((0, 0), (0, 1), "-|>"),
      edge((0, 1), (0, 2), "-|>"),
      edge((0, 2), (0, 3), "-|>"),

      test((0, 3), [EOF?]),
      emit((1, 3), [Emit `eof`]),
      terminal((2, 3), [Tokens and \ diagnostics]),
      edge((0, 3), (1, 3), "-|>", [yes]),
      edge((1, 3), (2, 3), "-|>"),

      test((0, 4), [Whitespace?]),
      edge((0, 3), (0, 4), "-|>", [no]),
      edge((0, 4), (-1, 4), "-", [yes], label-side: right),
      edge((-1, 4), (-1, 2), (0, 2), "-|>", [consume], label-pos: (0, 0.5), label-side: right),

      test((0, 5), [Letter?]),
      mode((1, 5), "identifier", name: <identifier>),
      emit((4, 5), [Emit a keyword, \ `boolean`, or `identifier`]),
      edge((0, 4), (0, 5), "-|>", [no]),
      edge((0, 5), <identifier>, "-|>", [yes]),
      edge(<identifier>, <identifier>, "-|>", [letter or digit], bend: 130deg),
      edge(<identifier>, (4, 5), "-|>", [other]),

      test((0, 6), [Digit?]),
      mode((1, 6), "integer", name: <integer>),
      mode((1, 7), "float", name: <float>),
      emit((4, 6), [Emit `integer`]),
      emit((4, 7), [Emit `float-literal`]),
      edge((0, 5), (0, 6), "-|>", [no]),
      edge((0, 6), <integer>, "-|>", [yes]),
      edge(<integer>, <integer>, "-|>", [digit], bend: 130deg),
      edge(<integer>, (4, 6), "-|>", [other]),
      edge(<integer>, <float>, "-|>", [#char(".") then a digit], label-side: left),
      edge(<float>, <float>, "-|>", [digit], bend: 130deg, loop-angle: 180deg),
      edge(<float>, (4, 7), "-|>", [other]),

      test((0, 9), [#char("'")?]),
      mode((1, 9), "character-value", name: <value>),
      mode((2, 9), "character-close", name: <close>),
      mode((3, 9), "character-end", name: <end>),
      mode((2, 11), "character-invalid", name: <bad-char>),
      mode((3, 11), "character-error", name: <char-error>),
      report((4, 8), [Error: unterminated \ character literal]),
      emit((4, 9), [Emit `char-literal`]),
      report((4, 11), [Error: invalid \ character literal]),
      edge((0, 6), (0, 9), "-|>", [no]),
      edge((0, 9), <value>, "-|>", [yes]),
      edge(<value>, <close>, "-|>", [ASCII], label-pos: 0.45),
      edge(<close>, <end>, "-|>", char("'"), label-side: right),
      edge(<end>, (4, 9), "-|>"),
      edge(<value>, (1, 8), (4, 8), "-|>", [EOF], label-pos: (1, 0.6)),
      edge(<close>, (2, 8), "-"),
      edge(<value>, (1, 11), <bad-char>, "-|>", [not ASCII], label-pos: (0, 0.3), label-side: right),
      edge(<close>, (1, 10), "-", [other], label-side: left),
      edge(<bad-char>, <bad-char>, "-|>", [other], bend: 130deg),
      edge(<bad-char>, <char-error>, "-|>", char("'"), label-side: right),
      edge(<char-error>, (4, 11), "-|>"),
      edge(<bad-char>, (2, 11.45), (4, 11.45), (4, 11), "-|>", [EOF], label-pos: (1, 0.3), label-side: right),

      test((0, 12), [Starts a \ symbol?]),
      mode((1, 12), "symbol", name: <symbol>),
      test((2, 12), [Lexeme is \ a symbol?]),
      emit((4, 12), [Emit the symbol]),
      report((4, 13), [Error: isolated \ `&` or `|`]),
      edge((0, 9), (0, 12), "-|>", [no]),
      edge((0, 12), <symbol>, "-|>", [yes]),
      edge(<symbol>, <symbol>, "-|>", [longer symbol], bend: 130deg, loop-angle: -90deg),
      edge(<symbol>, (2, 12), "-|>", [other]),
      edge((2, 12), (4, 12), "-|>", [yes]),
      edge((2, 12), (2, 13), (4, 13), "-|>", [no]),

      mode((1, 14), "invalid", name: <invalid>),
      report((4, 14), [Error: unexpected \ character]),
      edge((0, 12), (0, 14), <invalid>, "-|>", [no]),
      edge(<invalid>, (4, 14), "-|>"),

      ..(5, 6, 7, 8, 9, 11, 12, 13, 14).map(y => edge((4, y), (5, y))),
      edge(
        (5, 14),
        (5, 2),
        (0, 2),
        "-|>",
        [Go back to the `start` mode. Do not consume the lookahead.],
        label-pos: (1, 0.5),
        label-side: right,
      ),
    )
  },
  caption: [
    The steps of the lexer. A symbol is an operator or a delimiter.
    Blue boxes are modes. Each arrow into a mode consumes one character.
    Green boxes emit a token and red boxes emit a diagnostic. They do not consume a character.
  ],
)

#pagebreak()

= Sample input

The following is the `full-scope.clite` sample used to exercise the lexer.
It includes declarations, arrays, literals, operators, delimiters, and control
flow. The sample is read from the project file when this document is compiled.

#set text(size: 8pt)
#raw(read("../samples/full-scope.clite"), block: true)

#pagebreak()

= Symbol table sample

This excerpt shows the token kind and original lexeme produced for representative
parts of the sample input. Keywords and boolean literals receive their reserved
token kinds; punctuation and operators are tokens as well.

#table(
  columns: (0.7fr, 1.5fr, 1.2fr),
  [*No.*], [*Token kind*], [*Lexeme*],
  [1], [int], [`int`],
  [2], [main], [`main`],
  [3], [`(`], [`(`],
  [4], [`{`], [`{`],
  [5], [identifier], [`count`],
  [6], [`[`], [`[`],
  [7], [integer], [`10`],
  [8], [boolean], [`true`],
  [9], [float-literal], [`2.50`],
  [10], [char-literal], [`'A'`],
  [11], [while], [`while`],
  [12], [`<`], [`<`],
  [13], [`&&`], [`&&`],
  [14], [`==`], [`==`],
  [15], [`+`], [`+`],
  [16], [eof], [empty string],
)

#pagebreak()

= Lexer source code

The lexer is implemented in TypeScript. The complete implementation and its
type definitions are included below from the project source files.

#set text(size: 7pt)
== `lexer.ts`
#raw(read("../src/lexer/lexer.ts"), block: true)

#pagebreak()

== `types.ts`
#raw(read("../src/lexer/types.ts"), block: true)

#pagebreak()

= Lexer output screenshot

The project GUI provides source editing and sample selection, step/playback
controls, lexer-state display, source highlighting, and a token table with
token kinds and lexemes.

#figure(
  image("images/gui-step.png", width: 100%),
  caption: [The Clite lexer GUI after processing `full-scope.clite`.],
)
