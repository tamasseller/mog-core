# TODO

## Open

**`validateProgram` range-checks shift immediates only.** `validate.ts`'s
guard covers `SHIFT_OPS`; every other immediate combo takes any value,
including one `encodeLeb128` cannot encode. So the validator can approve a
program the encoder rejects. Surfaced by constant folding reaching an
immediate combo with a negative value — the core's immediates coerce now
(rtl.ts's `asImm`), the gate is unchanged. Settling the legal range per
immediate kind is a contract change, not a bug fix.

Related, and now closed: `foldBinaryOp` used to mask a shift amount to five
bits the way JS does, so §4.1's `0..31` was enforced by `validate.ts` and
`vm.ts` but not by folding — making the answer depend on where the shift sat
in the expression. `UnspecifiedShiftAmount` moved to `rtl.ts` beside
`SHIFT_OPS`, and all three sites throw it.

**No fold turns a subtraction of a large constant into an addition.**
`a - -31` folds to `a - 0xffffffe1` and lowers to `CONST 31; NEG; RSUB`,
because a 5-byte LEB128 immediate loses to three short instructions on
cost. `a - 0xffffffe1` is `a + 31`. Codegen quality, not correctness.

**Replace the generated parser with a hand-written one.** No longer a
performance item — see below. What is left is that `build:grammar` is a
build step, `src/parser.js` is 98KB of generated code carried in git, and
peggy is a devDependency. Against that, a tokenizer plus precedence-climbing
recursive descent has to carry its own diagnostics: peggy's "Expected X but
found Y" is free today, and `mog-jit/fuzz/ts/invalid.ts` classifies refusals
on that text.

Related, and now closed: parse time was exponential in expression nesting,
recorded here as roughly 2x per level and read as backtracking through the
precedence cascade — a property of PEG parsing. It was not. Two rules were
written as ordered choices whose first alternative consumed the operand
before failing, so each parsed its operand twice whenever the tail was
absent: `ConditionalExpression` with no `?`, and `PostfixExpression` with no
`++`/`--`, the latter over a whole parenthesised subexpression. Two
independent doublings compose, so the real cost was 4x per level. Both are
an optional tail now. Height 10 went 14359ms to 0.36ms and `test/bench.ts`
at n=64 went parse=2049ms to 2.5ms, with byte-identical ASTs; tiling is the
dominant cost again, as that file always said it should be.
