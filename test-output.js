#!/usr/bin/env node
// Ultra-simple test to verify stdout works
console.log('TEST OUTPUT 1');
process.stdout.write('TEST OUTPUT 2\n');
console.error('TEST OUTPUT 3 (stderr)');
process.stderr.write('TEST OUTPUT 4 (stderr)\n');
console.log('If you see this, stdout is working!');
process.exit(0);