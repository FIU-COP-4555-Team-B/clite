#import "@preview/fletcher:0.5.8": diagram, node, edge, shapes

#set document(title: [Clite lexer flowchart])
#set page(paper: "a3", flipped: true, margin: 8mm)
#set text(font: "Liberation Sans", size: 9pt, fill: rgb("#243247"))
#set par(leading: 0.45em)

#let blue = rgb("#eaf2fc")
#let green = rgb("#eaf5ee")
#let red = rgb("#fceeed")
#let gold = rgb("#fff6dc")

#let p(x, y) = (x * 1mm, -y * 0.85mm)

#let chart(..items) = diagram(
  node-stroke: 0.6pt + rgb("#718096"),
  node-fill: white,
  node-shape: rect,
  node-inset: 2mm,
  node-corner-radius: 1.5mm,
  edge-stroke: 0.65pt + rgb("#526278"),
  edge-corner-radius: 2mm,
  label-size: 8pt,
  ..items.pos(),
)

#let state = node.with(fill: blue)
#let emit = node.with(fill: green)
#let fail = node.with(fill: red)
#let test = node.with(shape: shapes.diamond.with(fit: 0), fill: gold, corner-radius: 0pt)

#align(center, text(size: 16pt, weight: "bold")[Clite lexer])
#v(2mm)

#align(center, chart(
  node(p(23, 13), [Initialize\ tokens = \[\], diagnostics = \[\]\ mode = start; offset = 0\ line = 1; column = 1], width: 46mm, name: <init>),
  state(p(88, 13), [*step(source, state)*\ Follow one transition\ in the mode charts below], width: 49mm, name: <step>),
  test(p(147, 13), [Event?], width: 25mm, height: 17mm, name: <event>),
  node(p(210, -1), [No output], width: 43mm, name: <consume>),
  emit(p(210, 13), [Append token], width: 43mm, name: <token>),
  fail(p(210, 27), [Append diagnostic], width: 43mm, name: <diagnostic>),
  node(p(275, 13), [state = result.state], width: 44mm, name: <update>),
  test(p(327, 13), [Mode\ done?], width: 27mm, height: 19mm, name: <done>),
  emit(p(378, 13), [Return tokens\ and diagnostics], width: 43mm, name: <return>),

  edge(<init>, <step>, "-|>"),
  edge(<step>, <event>, "-|>"),
  edge(<event>, <consume>, "-|>", [consume]),
  edge(<event>, <token>, "-|>", [emit / finish]),
  edge(<event>, <diagnostic>, "-|>", [error]),
  edge(<consume>, <update>, "-|>"),
  edge(<token>, <update>, "-|>"),
  edge(<diagnostic>, <update>, "-|>"),
  edge(<update>, <done>, "-|>"),
  edge(<done>, <return>, "-|>", [yes]),
  edge(<done.north>, p(327, -13), p(88, -13), <step.north>, "-|>", [no: next step], label-pos: 0.55),
))

#v(2mm)
#grid(
  columns: (89mm, 135mm, 160mm),
  column-gutter: 7mm,
  align: top + center,
  [
    #align(center, text(size: 11pt, weight: "bold")[start — inspect the next code point])
    #v(2mm)
    #chart(
      test(p(15, 10), [EOF?], width: 28mm, height: 16mm, name: <eof>),
      emit(p(66, 10), [finish: eof token\ → done], width: 41mm, name: <finish>),
      test(p(15, 37), [White-\ space?], width: 28mm, height: 19mm, name: <space>),
      state(p(66, 37), [consume\ → start], width: 41mm, name: <skip>),
      test(p(15, 64), [ASCII\ letter?], width: 28mm, height: 19mm, name: <letter>),
      state(p(66, 64), [consume\ → identifier], width: 41mm, name: <identifier>),
      test(p(15, 91), [Digit?], width: 28mm, height: 16mm, name: <digit>),
      state(p(66, 91), [consume\ → integer], width: 41mm, name: <integer>),
      test(p(15, 118), [Apostrophe?], width: 28mm, height: 21mm, name: <quote>),
      state(p(66, 118), [consume\ → character-value], width: 41mm, name: <character>),
      test(p(15, 149), [Symbol\ starter?], width: 28mm, height: 19mm, name: <symbol>),
      state(p(66, 149), [consume\ → symbol], width: 41mm, name: <symbol-mode>),
      state(p(15, 180), [consume\ → invalid], width: 30mm, name: <invalid>),
      node(p(57, 189), [Symbol starter:\ any supported single symbol,\ or #raw("&") or #raw("|")], width: 55mm, stroke: none, fill: none),

      edge(<eof>, <finish>, "-|>", [yes]),
      edge(<eof>, <space>, "-|>", [no]),
      edge(<space>, <skip>, "-|>", [yes]),
      edge(<space>, <letter>, "-|>", [no]),
      edge(<letter>, <identifier>, "-|>", [yes]),
      edge(<letter>, <digit>, "-|>", [no]),
      edge(<digit>, <integer>, "-|>", [yes]),
      edge(<digit>, <quote>, "-|>", [no]),
      edge(<quote>, <character>, "-|>", [yes]),
      edge(<quote>, <symbol>, "-|>", [no]),
      edge(<symbol>, <symbol-mode>, "-|>", [yes]),
      edge(<symbol>, <invalid>, "-|>", [no]),
    )
  ],
  [
    #align(center, text(size: 11pt, weight: "bold")[Identifiers, numbers, symbols, and invalid input])
    #v(2mm)
    #chart(
      state(p(25, 14), [identifier], width: 40mm, name: <id>),
      emit(p(96, 14), [emit keyword, boolean,\ or identifier], width: 54mm, name: <emit-id>),
      state(p(25, 61), [integer], width: 40mm, name: <int>),
      emit(p(96, 61), [emit integer], width: 54mm, name: <emit-int>),
      state(p(25, 107), [float], width: 40mm, name: <float>),
      emit(p(96, 107), [emit float-literal], width: 54mm, name: <emit-float>),
      state(p(20, 155), [symbol], width: 30mm, name: <sym>),
      test(p(66, 155), [Lexeme is\ a symbol?], width: 31mm, height: 24mm, name: <known-symbol>),
      emit(p(110, 139), [emit symbol], width: 32mm, name: <emit-symbol>),
      fail(p(110, 175), [error: isolated\ #raw("&") or #raw("|")], width: 32mm, name: <bad-symbol>),
      state(p(25, 202), [invalid], width: 40mm, name: <bad>),
      fail(p(96, 202), [error: unexpected\ code point already skipped], width: 54mm, name: <bad-character>),

      edge(<id>, <id>, "-|>", [letter / digit:\ consume], bend: 135deg),
      edge(<id>, <emit-id>, "-|>", [otherwise]),
      edge(<int>, <int>, "-|>", [digit: consume], bend: 135deg),
      edge(<int>, <emit-int>, "-|>", [otherwise]),
      edge(<int>, <float>, "-|>", [#raw(".") followed by digit:\ consume only #raw(".")]),
      edge(<float>, <float>, "-|>", [digit: consume], bend: 135deg, loop-angle: -90deg),
      edge(<float>, <emit-float>, "-|>", [otherwise]),
      edge(<sym>, <sym>, "-|>", [next code point extends\ to a valid symbol: consume], bend: 135deg),
      edge(<sym>, <known-symbol>, "-|>", [otherwise]),
      edge(<known-symbol>, <emit-symbol>, "-|>", [yes]),
      edge(<known-symbol>, <bad-symbol>, "-|>", [no]),
      edge(<bad>, <bad-character>, "-|>"),
    )
  ],
  [
    #align(center, text(size: 11pt, weight: "bold")[Character literal modes])
    #v(2mm)
    #chart(
      state(p(36, 14), [character-value], width: 48mm, name: <value>),
      state(p(36, 70), [character-close], width: 48mm, name: <close>),
      state(p(36, 123), [character-end], width: 48mm, name: <end>),
      state(p(117, 70), [character-invalid], width: 48mm, name: <recover>),
      state(p(117, 123), [character-error], width: 48mm, name: <error>),
      emit(p(36, 173), [emit char-literal], width: 48mm, name: <emit-char>),
      fail(p(117, 173), [error: unterminated\ or invalid character literal], width: 48mm, name: <fail-char>),
      node(p(78, 202), [One ASCII value, then a closing apostrophe; no escapes.], stroke: none, fill: none),

      edge(<value>, <close>, "-|>", [ASCII:\ consume]),
      edge(<value.east>, p(78, 14), p(78, 70), <recover.west>, "-|>", [non-ASCII:\ consume], label-pos: (1, 0.4)),
      edge(<close>, <end>, "-|>", [apostrophe:\ consume]),
      edge(<close>, <recover>, "-|>", [other:\ consume], label-pos: 0.25),
      edge(<recover>, <recover>, "-|>", [other code point:\ consume], bend: 135deg),
      edge(<recover>, <error>, "-|>", [apostrophe:\ consume]),
      edge(<end>, <emit-char>, "-|>"),
      edge(<error>, <fail-char>, "-|>"),
      edge(<value.west>, p(0, 14), p(0, 194), p(117, 194), <fail-char.south>, "-|>", [EOF], label-pos: (0, 0.6)),
      edge(<close.west>, p(0, 70), "-", [EOF]),
      edge(<recover.east>, p(155, 70), p(155, 173), <fail-char.east>, "-|>", [EOF], label-pos: (1, 0.5)),
    )
  ],
)

#v(2mm)
#align(center, text(size: 8.5pt)[
  *consume* → advance one code point, update position, and continue in the next step
  #h(4mm) | #h(4mm)
  *emit / error* → keep lookahead and reset to start
  #h(4mm) | #h(4mm)
  *EOF* → end of input; pending tokens and errors are handled before finish
])
