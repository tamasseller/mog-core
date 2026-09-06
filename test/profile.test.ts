// Target profiles (profile.ts): the bounds one deployment puts on a program
// whose ISA it fully implements, checked off the stats `validateProgram`
// already returns.
import { describe, test } from "node:test"
import assert from "node:assert/strict"

import { checkProfile, assertProfile } from "../src/profile"
import type { TargetProfile } from "../src/profile"
import { ARMV6M_PROFILE } from "../src/jit-armv6m"
import { validateProgram } from "../src/validate"
import { bare, CONST, LOAD, PUSH } from "../src/rtl"
import type { RtlProgram } from "../src/rtl"

/** `localPeak` starts at `argCount`, so arguments alone drive it past any
 *  frame-encoding bound — no operand pushes needed. */
function deepProgram(argCount: number): RtlProgram
{
    return { procedures: [{ argCount, body: [bare("RETURN")] }] }
}

function smallProgram(): RtlProgram
{
    return { procedures: [{ argCount: 0, body: [CONST(7), bare("RETURN")] }] }
}

function check(program: RtlProgram, profile: TargetProfile)
{
    return checkProfile(program, validateProgram(program), profile)
}

describe("checkProfile", () =>
{
    test("an ordinary program violates nothing", () =>
    {
        assert.deepEqual(check(smallProgram(), ARMV6M_PROFILE), [])
    })

    test("maxLocalDepth is what one ADD sp,#imm7 can reclaim", () =>
    {
        assert.deepEqual(check(deepProgram(131), ARMV6M_PROFILE), [])

        const found = check(deepProgram(132), ARMV6M_PROFILE)
        assert.equal(found.length, 1)
        assert.deepEqual(found[0]!.limit, "maxLocalDepth")
        assert.equal(found[0]!.procedure, 0)
        assert.equal(found[0]!.actual, 132)
        assert.equal(found[0]!.allowed, 131)
        assert.match(found[0]!.message, /^procedure 0: localPeak 132 exceeds the armv6m profile's maxLocalDepth of 131$/)
    })

    test("it counts pushed operands, not only arguments", () =>
    {
        // 128 arguments plus four pushed operands: the same 132 by another
        // route, and the one that actually matters — a fuzzer produces it by
        // the thousand where nothing declares 132 parameters.
        const body = [LOAD(0), PUSH(), PUSH(), PUSH(), PUSH(), bare("RETURN")]
        const program: RtlProgram = { procedures: [{ argCount: 128, body }] }
        const found = checkProfile(program, validateProgram(program), ARMV6M_PROFILE)

        assert.equal(found.length, 1)
        assert.equal(found[0]!.limit, "maxLocalDepth")
        assert.equal(found[0]!.actual, 132)
    })

    test("maxArgCount and maxProcCount are whole-header limits", () =>
    {
        const narrow: TargetProfile = { name: "narrow", maxArgCount: 2, maxProcCount: 1 }
        const program: RtlProgram = {
            procedures: [
                { argCount: 0, body: [CONST(0), bare("RETURN")] },
                { argCount: 3, body: [bare("RETURN")] },
            ],
        }
        // Procedure 1 is unreachable, which is fine: a profile bounds what the
        // image must be able to encode, not what it must be able to run.
        const found = checkProfile(program, validateProgram(program), narrow)

        assert.deepEqual(found.map(v => [v.limit, v.procedure]), [
            ["maxProcCount", undefined],
            ["maxArgCount", 1],
        ])
    })

    test("maxBodyBytes is measured on the encoded body", () =>
    {
        const program = smallProgram() // CONST 7; RETURN — two bytes
        assert.deepEqual(check(program, { name: "tight", maxBodyBytes: 2 }), [])

        const found = check(program, { name: "tight", maxBodyBytes: 1 })
        assert.equal(found.length, 1)
        assert.equal(found[0]!.actual, 2)
        assert.match(found[0]!.message, /procedure 0: bodyBytes 2 /)
    })

    test("a limit the profile leaves out is not a limit", () =>
    {
        assert.deepEqual(check(deepProgram(2047), { name: "unbounded" }), [])
    })
})

describe("assertProfile", () =>
{
    test("throws on the first violation", () =>
    {
        const program = deepProgram(200)
        const stats = validateProgram(program)

        assert.throws(() => assertProfile(program, stats, ARMV6M_PROFILE),
            /procedure 0: localPeak 200 exceeds the armv6m profile's maxLocalDepth of 131/)
    })

    test("stays silent on a program inside the profile", () =>
    {
        const program = smallProgram()
        assertProfile(program, validateProgram(program), ARMV6M_PROFILE)
    })
})
