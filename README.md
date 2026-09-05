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

## Using it

A procedure is C written inside an `` ir`...` `` template. `lowerProgram`
compiles it, `run` is the reference VM.

```ts
import { ir, proc, lowerProgram, validateProgram, encodeProgram, run } from "mog-core"

const sum = proc(["n"], ir`
    u32 total = 0;
    for (u32 i = 0; i != n; i++) total += i;
    return total;
`)

run(lowerProgram(sum), undefined, [5]).acc   // 10
```

A `Procedure` spliced into the template is a call to it. `lowerProgram`
walks out from the entry point and emits everything reachable, so only the
entry is named:

```ts
const abs  = proc(["i32 v"], ir`return v < 0 ? -v : v;`)
const dist = proc(["i32 a", "i32 b"], ir`return ${abs}(a - b);`)

run(lowerProgram(dist), undefined, [3, 11]).acc   // 8
```

What the machine is actually for is the last step: a target gets the bytes,
and the numbers it needs to size everything up front — before it runs a
single instruction, and without trusting whoever sent the program.

```ts
const program = lowerProgram(dist)

validateProgram(program)   // { procedures: [...], totalDepth: 3, maxCallDepth: 1 }
encodeProgram(program)     // 22 bytes
```

`validateProgram` throws on anything isa-core.md §8 rejects, so a program
that survives it needs no runtime checks for the things it proved.

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

[`vscode-ir-syntax/`](vscode-ir-syntax) is a VS Code extension that
syntax-highlights the C inside `` ir`...` `` template literals. It is not
part of the npm package.

## Commands

```sh
npm run build        # regenerate the parser (peggy), then tsc
npm test             # test/run.ts
npm run test:types   # tsc --noEmit over the test tsconfig
```
