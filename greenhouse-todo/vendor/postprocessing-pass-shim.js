// Minimal stand-in for the `postprocessing` library's `Pass` export.
//
// Why this exists: n8ao ships two passes in one module — `N8AOPass` (built on
// three's own `Pass`, which is what we use) and `N8AOPostPass` (built on the
// separate `postprocessing` library's `Pass`). Both are declared at module
// scope, so `class N8AOPostPass extends Pass` is evaluated the moment n8ao is
// imported, which means the bare specifier `postprocessing` has to resolve even
// though we never touch `N8AOPostPass`.
//
// Resolving it to the real library would download ~350 kB of code to supply a
// base class that is never instantiated. An empty class satisfies the `extends`
// clause exactly as well. If this project ever adopts the `postprocessing`
// library for real, delete this file and point the importmap entry in
// index.html at the actual package.
export class Pass {}
