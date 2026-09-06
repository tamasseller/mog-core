/**
 * mog-core — Target profiles: what one deployment can encode.
 *
 * `validate.ts` enforces isa-core.md §8's five *generic* guarantees —
 * properties that hold for any target the machine could ever back. A
 * profile is the orthogonal dimension: the bounds one concrete deployment
 * puts on a program it fully implements the semantics of. `localPeak <=
 * 131` is not a property of MOG; it is ARMv6-M's `ADD sp,#imm7` seen
 * through a four-register window.
 *
 * So a profile is not an `Extension` — that carries ISA semantics (rules,
 * effects, exec, codec) for a capability the machine *gains* — and it is
 * not a constant inside `validateProgram`, which knows no target. It is a
 * value supplied by whoever knows the target, checked alongside §8's own
 * checks and reported separately.
 *
 * Every quantity here is a static property of the program, which is what
 * makes it checkable off-target at all: a limit that depends on live memory
 * or on emitted-code size cannot be, and stays the target's own runtime
 * check. What a profile buys is the diagnostic — a named error where the
 * source still exists, rather than an error code from a device after
 * deployment — and, behind that, the licence for the target to demote a
 * check the producer has already made.
 */

import type { RtlProgram, ExtOpPayload } from "./rtl"
import type { Extension } from "./extension"
import type { ProgramStats } from "./validate"
import { encodeBody } from "./bytecode"

export type ProfileLimit = "maxProcCount" | "maxArgCount" | "maxBodyBytes" | "maxLocalDepth"

export interface TargetProfile
{
    /** Names the deployment in a violation message. */
    name: string
    /** Procedures in the program. */
    maxProcCount?: number
    /** Any one procedure's `arg_count` (isa-core.md §2.3). */
    maxArgCount?: number
    /** Any one procedure's encoded body length. */
    maxBodyBytes?: number
    /** Any one procedure's `ProcedureStats.localPeak` — max TOS depth
     *  reached in its own frame, `argCount` included. Not `totalDepth`:
     *  a frame-encoding limit is per-frame, and the whole-program figure
     *  bounds a *memory* reservation instead. */
    maxLocalDepth?: number
}

export interface ProfileViolation
{
    limit: ProfileLimit
    /** Procedure-table index, absent for a whole-program limit. */
    procedure?: number
    actual: number
    allowed: number
    message: string
}

function violation(profile: TargetProfile, limit: ProfileLimit, quantity: string, actual: number, allowed: number, procedure?: number): ProfileViolation
{
    const where = procedure === undefined ? "" : `procedure ${procedure}: `
    return {
        limit,
        procedure,
        actual,
        allowed,
        message: `${where}${quantity} ${actual} exceeds the ${profile.name} profile's ${limit} of ${allowed}`,
    }
}

/**
 * Every way `program` falls outside `profile`, in procedure-table order.
 * `stats` is `validateProgram`'s own return value — the profile needs no
 * walk of its own, only a place to state the bounds.
 */
export function checkProfile<E extends { ext: string } = ExtOpPayload>(
    program: RtlProgram<E>,
    stats: ProgramStats,
    profile: TargetProfile,
    extension?: Extension<E>,
): ProfileViolation[]
{
    const found: ProfileViolation[] = []

    if(profile.maxProcCount !== undefined && program.procedures.length > profile.maxProcCount)
        found.push(violation(profile, "maxProcCount", "procCount", program.procedures.length, profile.maxProcCount))

    for(let i = 0; i < program.procedures.length; i++)
    {
        const proc = program.procedures[i]!

        if(profile.maxArgCount !== undefined && proc.argCount > profile.maxArgCount)
            found.push(violation(profile, "maxArgCount", "argCount", proc.argCount, profile.maxArgCount, i))

        const localPeak = stats.procedures[i]?.localPeak
        if(profile.maxLocalDepth !== undefined && localPeak !== undefined && localPeak > profile.maxLocalDepth)
            found.push(violation(profile, "maxLocalDepth", "localPeak", localPeak, profile.maxLocalDepth, i))

        // The one quantity not already in `stats`. Encoding a body twice is
        // the price of stating the bound in bytes, which is what the field
        // it guards is measured in.
        if(profile.maxBodyBytes !== undefined)
        {
            const bodyBytes = encodeBody(proc.body, extension).length
            if(bodyBytes > profile.maxBodyBytes)
                found.push(violation(profile, "maxBodyBytes", "bodyBytes", bodyBytes, profile.maxBodyBytes, i))
        }
    }

    return found
}

/** `checkProfile`, throwing on the first violation — fail-fast, matching
 *  `validateProgram`'s own style. */
export function assertProfile<E extends { ext: string } = ExtOpPayload>(
    program: RtlProgram<E>,
    stats: ProgramStats,
    profile: TargetProfile,
    extension?: Extension<E>,
): void
{
    const found = checkProfile(program, stats, profile, extension)
    if(found.length > 0) throw new Error(found[0]!.message)
}
