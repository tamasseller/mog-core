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

**Replace the generated parser with a hand-written one.** Parse time under
peggy is roughly 2x per level of expression nesting and near-independent of
length: measured over 2087 bodies, height 4 at 96 chars parses in 0.37ms,
height 13 at 592 chars in 744ms. That is backtracking through the
precedence cascade, so it is a shape cost, not a constant factor. A
tokenizer plus precedence-climbing recursive descent is linear. It also caps
what mog-jit's fuzzer can generate — `MAX_EXPR_HEIGHT` is 8 because of
this. Not currently blocking: the fuzzer stopped parsing per candidate.
