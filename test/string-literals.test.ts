/**
 * Compile-time string and byte-string literals (isa-core.md §10.2): parsed,
 * matched by an extension's builtin rule, and rejected anywhere a value is
 * needed.
 */
import { describe, test } from "node:test"
import assert from "node:assert/strict"

import { parse } from "../src/parser.js"
import { ir, proc } from "../src/ir"
import { lowerProgram } from "../src/lower"
import { validateProgram } from "../src/validate"
import { run } from "../src/vm"
import { rule, leafNode } from "../src/rules"
import { pBuiltinCall, pConst, pString, pBytes, pImmediate, pTail } from "../src/matcher"
import { extInstr } from "../src/rtl"
import type { ExtInstr } from "../src/rtl"
import type { Extension } from "../src/extension"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expr = (src: string): any => (parse(`${src};`) as any).body[0].expression

/** `name(s)` lowers to one op per call, recording what the rule matched so
 *  a test can read it back: the string itself, and one tail entry per
 *  immediate, tagged by the kind it matched as. */
function recordingExtension(seen: unknown[]): Extension
{
    return {
        rules: () => [
            rule("ext:named", pBuiltinCall("named", pString(), pTail(pImmediate())), m =>
            {
                seen.push({ name: m.argumentMatches[0].value, tail: m.tailMatches!.map(t => [t.kind, t.value]) })
                return leafNode(["acc"], [extInstr("NAMED", [])], [], 0, 0)
            }),
            rule("ext:blob", pBuiltinCall("blob", pBytes()), m =>
            {
                seen.push(m.argumentMatches[0].value)
                return leafNode(["acc"], [extInstr("NAMED", [])], [], 0, 0)
            }),
            rule("ext:fail", pBuiltinCall("fail", pConst()), m =>
                leafNode(["acc"], [extInstr("FAIL", [m.argumentMatches[0].value])], [], 0, 0)),
        ],
        effects: {
            NAMED: { tosDelta: 0, maxTransient: 0, killsAcc: true },
            FAIL: { tosDelta: 0, maxTransient: 0, killsAcc: true },
        },
        exec: (instr: ExtInstr, state) => { if(instr.ext === "FAIL") state.trap!(instr.operands[0]!) },
    }
}

describe("string literals — grammar", () =>
{
    test("a string parses to its unescaped value", () =>
    {
        assert.deepEqual(expr(`f("a\\"b\\\\c")`).arguments[0], { type: "StringLiteral", value: `a"b\\c`, raw: `"a\\"b\\\\c"` })
    })

    test("an empty string parses", () =>
    {
        assert.equal(expr(`f("")`).arguments[0].value, "")
    })

    test("a byte string parses to its bytes", () =>
    {
        assert.deepEqual(expr(`f(x"00ff1a")`).arguments[0], { type: "BytesLiteral", value: [0x00, 0xff, 0x1a], raw: `x"00ff1a"` })
    })

    test("a byte string with an odd digit count is rejected", () =>
    {
        assert.throws(() => parse(`f(x"abc");`))
    })

    test("an escape other than \\\" and \\\\ is rejected", () =>
    {
        assert.throws(() => parse(`f("a\\nb");`))
    })

    test("an identifier named x still parses", () =>
    {
        assert.deepEqual(expr(`x`), { type: "Identifier", name: "x" })
    })
})

describe("string literals — matched by an extension rule", () =>
{
    test("pString and a pImmediate tail see each literal's own kind", () =>
    {
        const seen: unknown[] = []
        const ext = recordingExtension(seen)
        lowerProgram(proc([], ir`named("CRC", "width", 16, "poly", 0x1021, "iv", x"0102"); return;`), ext)
        assert.deepEqual(seen[0], {
            name: "CRC",
            tail: [["String", "width"], ["Literal", 16], ["String", "poly"], ["Literal", 0x1021], ["String", "iv"], ["Bytes", [1, 2]]],
        })
    })

    test("pImmediate takes a folded constant too", () =>
    {
        const seen: unknown[] = []
        lowerProgram(proc([], ir`named("n", 1 + 2); return;`), recordingExtension(seen))
        assert.deepEqual(seen[0], { name: "n", tail: [["Literal", 3]] })
    })

    test("pBytes matches a byte string", () =>
    {
        const seen: unknown[] = []
        lowerProgram(proc([], ir`blob(x"dead"); return;`), recordingExtension(seen))
        assert.deepEqual(seen[0], [0xde, 0xad])
    })

    test("pString does not match a number, nor pConst a string", () =>
    {
        const ext = recordingExtension([])
        assert.throws(() => lowerProgram(proc([], ir`named(3); return;`), ext))
        assert.throws(() => lowerProgram(proc([], ir`fail("3"); return;`), ext))
    })
})

describe("string literals — never a value", () =>
{
    for(const [what, src] of [
        ["an assignment", `u32 x; x = "a"; return;`],
        ["an operand", `u32 x = 1 + "a"; return;`],
        ["a return value", `return "a";`],
        ["a byte string as an operand", `u32 x = x"00" + 1; return;`],
    ] as const)
    {
        test(`rejected as ${what}`, () =>
        {
            assert.throws(() => lowerProgram(proc([], ir([src] as unknown as TemplateStringsArray)), recordingExtension([])),
                /only valid as a built-in's argument/)
        })
    }

    test("rejected as a procedure's argument", () =>
    {
        const callee = proc(["a"], ir`return a;`)
        assert.throws(() => lowerProgram(proc([], ir`return ${callee}("a");`)), /only valid as a built-in's argument/)
    })
})

describe("ExecState.trap — an extension op ends the program as TRAP does", () =>
{
    test("run reports the op's code", () =>
    {
        const ext = recordingExtension([])
        const program = lowerProgram(proc([], ir`fail(77); return;`), ext)
        validateProgram(program, ext)
        const result = run(program, ext)
        assert.equal(result.ok, false)
        assert.equal(result.trapCode, 77)
        assert.equal(result.trapDepth, 0)
    })
})
