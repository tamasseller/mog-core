# Application domains

> **Status:** the intended uses, for checking a design decision against.
> Not normative — nothing here constrains a conforming implementation.

## What MOG is

A bounded execution environment for small program fragments injected into an
MCU-based system at run time, without building a firmware image for them.
Scripted behaviour without a scripting engine's resource footprint,
unpredictability or performance penalty.

The core is domain-independent — arithmetic, control flow, program state
(isa-core.md §1). Everything an application needs to touch its environment
arrives as a domain extension (§11): the implement bolted to the chassis.
Applications differ in their extension, not in the core.

Intended applications, each with its own extension:

- Trigger and qualifier expressions on a logic analyzer or DSO.
- SWD/JTAG sequences run on the debugger probe itself, so a programming or
  end-of-line-test operation is not paced by USB frame delays.
- Trigger and reduction expressions on data acquisition devices.
- Packet sniffer filters.
- Wire-format codecs — the one candidate that is a codegen application
  rather than a JIT one, so it would never be a JIT target.

## The performance bar

Not competitive with well-optimized native code, and not aiming to be.
Choosing MOG for a fragment should cost a somewhat beefier MCU, not an order
of magnitude — close enough to `-Og` output that *some* numbercrunching is
in reach. The ISA is shaped so the JIT stays simple and the DSL lowerer need
not be a proper compiler (isa-rationale.md).

## What this constrains

- A fragment is small — tens of instructions per procedure, not thousands.
- A frame holds locals and temporaries. No arrays, no bulk application
  data: that belongs to the extension's own storage, so operand-stack
  frames of several hundred bytes are not a realistic shape.
- Realistic programs are written against a four-entry register window —
  arguments, locals and live temporaries together.
- Construct frequency across the test suite, the DSL corpus and the bench
  workloads says nothing about real programs; those exist to exercise
  paths. A tradeoff that turns on how often something occurs needs a
  workload from one of the domains above, not a corpus count.
