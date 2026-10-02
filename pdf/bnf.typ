#let opt-style = text.with(fill: rgb("#1565C0"), weight: "bold")
#let star-style = text.with(fill: rgb("#1565C0"), weight: "bold")
#let bar-style = text.with(fill: rgb("#1565C0"), weight: "bold")

#let _join(alternatives) = alternatives.join(h(0.3em) + bar-style[|] + h(0.3em))

#let Opt(..alternatives) = {
  (
    opt-style[\[] + h(0.08em) + _join(alternatives.pos()) + h(0.08em) + opt-style[\]]
  )
}

#let Star(..alternatives) = {
  (
    star-style[\{] + h(0.08em) + _join(alternatives.pos()) + h(0.08em) + star-style[\}]
  )
}

#let Prod(lhs, ..alternatives) = (
  lhs: lhs,
  alternatives: alternatives.pos(),
)

#let bnf(..rules) = {
  let cells = rules
    .pos()
    .fold((), (cells, rule) => {
      let rhs = _join(rule.alternatives)
      cells + (rule.lhs, [$arrow.double$], rhs)
    })

  grid(
    columns: (auto, auto, 1fr),
    column-gutter: 0.5em,
    row-gutter: 0.5em,
    ..cells,
  )
}
