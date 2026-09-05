# Inline IR Syntax Highlighting

A VS Code extension that highlights C syntax inside `` ir`...` `` tagged
template literals in TypeScript and JavaScript, the authoring surface for
this repository's bytecode DSL ([docs/isa-core.md](../docs/isa-core.md) §10).

The grammar is deliberately thin: it matches the `` ir` `` tag, hands
`${...}` back to TypeScript, and delegates the rest to VS Code's built-in C
grammar. It carries no keyword list of its own, so it needs no update when
the DSL gains or loses a construct — and it will happily colour C that the
DSL does not accept.

Injects `syntaxes/ir.tmLanguage.json` into `source.ts`/`source.tsx`/
`source.js`/`source.jsx`, scoped as `meta.embedded.block.c.ir-dsl`, and
italicizes embedded blocks by default while leaving `${...}` interpolations
in the host language's own styling.

```sh
npm run build        # vsce package → vscode-inline-ir-<version>.vsix
```

Install the packaged `.vsix` with `code --install-extension`.
