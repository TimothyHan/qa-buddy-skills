#!/usr/bin/env node
'use strict';
// v0.8.0 (RFC 0003 PR C): qab.js is a deprecation shim. The engine is Akela
// (npm: akela), vendored under references/engine/ and driven by bin/akela.js —
// same arguments, same behavior. This name keeps working for one release.
process.stderr.write('qab: deprecated entry point — use bin/akela.js (same arguments; the engine is Akela, RFC 0003)\n');
require('./akela.js');
