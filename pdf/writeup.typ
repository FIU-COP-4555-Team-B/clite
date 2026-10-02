#set document(title: [Clite Grammar])
#set page(paper: "us-letter", margin: (x: 0.7in, y: 0.5in))
#set text(font: "Liberation Serif", size: 10pt)

#import "bnf.typ": Opt, Prod, Star, bnf

#align(center, text(size: 16pt, [Clite Lexer]))

= Grammar

#bnf(
  Prod([Program], [int main() { Declarations Statements }]),
  Prod([Declarations], Star([Declaration])),
  Prod([Declaration], [Type Identifier #Opt([[Integer]]) #Star([, Identifier#Opt([[Integer]])])]),
  Prod([Type], [Integer], [Boolean], [Float], [Char]),
  Prod([Statements], Star([Statement])),
  Prod([Statement], [;], [Block], [Assignment], [If Statement], [While Statement]),
  Prod([Assignment], [Identifier = Expression;]),
  Prod([If Statement], [if (Expression) Statement #Opt([else Statement])]),
  Prod([While Statement], [while (Expression) Statement]),
  Prod([Expression], [Conjunction #Star([|| Conjunction])]),
  Prod([Conjunction], [Equality #Star([&& Equality])]),
  Prod([Equality], [Relation #Opt([EquOp Relation])]),
  Prod([EquOp], [==], [!=]),
  Prod([Relation], [Addition #Opt([RelOp Addition])]),
  Prod([RelOp], [<], [<=], [>], [>=]),
  Prod([Addition], [Term #Star([AddOp Term])]),
  Prod([Term], [Factor #Star([MulOp Factor])]),
  Prod([MulOp], [\*], [/], [%]),
  Prod([Factor], [#Opt([UnaryOp]) Primary]),
  Prod([UnaryOp], [-], [!]),
  Prod([Primary], [Identifier #Opt([[Expression]])], [Literal (Expression)], [Type (Expression)]),
  Prod([Identifier], [Letter #Star([Letter], [Digit])]),
  Prod([Letter], [a-z], [A-Z]),
  Prod([Digit], [0-9]),
  Prod([Literal], [Integer], [Boolean], [Float], [Char]),
  Prod([Integer], [Digit #Star([Digit])]),
  Prod([Boolean], [true], [false]),
  Prod([Float], [Integer.Integer]),
  Prod([Char], ['ASCII']),
  Prod([ASCII], [\x00 - \x7F]),
)
