# mog-core

The generic, domain-agnostic bytecode compiler and VM: IR authoring,
expression lowering, whole-program validation, execution, wire encoding,
and the extension hook a domain uses to add its own opcodes.

The core knows arithmetic, control flow and program state, and nothing
about any application domain. Everything that touches an environment — the
opcodes, their DSL surface, their execution and their wire form — arrives
as a registered `Extension` (`src/extension.ts`), so the core stays
ignorant of what those opcodes mean while still proving every static
guarantee over programs that use them.

## Docs

- [docs/isa-core.md](docs/isa-core.md): the normative ISA spec. Abstract
  machine, instruction reference, encoding, calling convention, static
  validation, the `ir` textual DSL, extension mechanism, full opcode table.
- [docs/isa-rationale.md](docs/isa-rationale.md): why the non-obvious
  choices in the spec are what they are.
- [docs/applications.md](docs/applications.md): what the machine is for,
  and what that constrains.

## Layout

| Path | What |
|---|---|
| `grammer.pegjs`, `src/parser.js`, `src/ast.ts` | the `ir` DSL: C99-subset grammar, generated parser, AST |
| `src/ir.ts` | `proc`/`declareProc`/`defineProc`, fragment identity and splicing |
| `src/east.ts`, `src/rtl.ts` | expression AST and RTL instruction/combo model |
| `src/matcher.ts`, `src/rules.ts`, `src/builders.ts`, `src/orchestrator.ts` | pattern-rewrite tiling: patterns, rule table, fragment combining, Pareto-pruned search |
| `src/lower.ts` | statement walk: AST → flat `RtlInstr[]`, one door into the expression pipeline |
| `src/scope.ts`, `src/desugar.ts`, `src/lift.ts`, `src/types.ts`, `src/expr.ts` | the expression pipeline's phases: scope/register allocation, derived-operator rewriting, the ternary/postfix lift, type annotation, tiling demand |
| `src/explain.ts` | why a tiling failed, reconstructed from the source for the message |
| `src/raise.ts` | the structural inverse of `lower.ts`, for target codegen |
| `src/validate.ts` | isa-core.md §8's whole-program checks, plus the stack-depth and call-depth bounds |
| `src/vm.ts` | reference interpreter |
| `src/bytecode.ts`, `src/encoding.ts` | procedure and program wire encoding (isa-core.md §5) |
| `src/extension.ts` | the `Extension` interface: per-opcode effect, DSL resolution, execution, wire encode/decode |

## Companion

`vscode-ir-syntax`, in the protocol-projection-language workspace, is a VS
Code extension that syntax-highlights the C code inside `` ir`...` ``
template literals.

## Commands

```sh
npm run build        # regenerate the parser (peggy), then tsc
npm test             # test/run.ts
npm run test:types   # tsc --noEmit over the test tsconfig
```
