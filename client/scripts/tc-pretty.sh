#!/bin/bash

cd "$(dirname "$0")/.." || exit 1

vue-tsc --noEmit -p tsconfig.app.json 2>&1 | node -e "
  process.stdin.resume();
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    console.log(
      d.replace(/\{ /g, '{\n    ')
       .replace(/; /g, ';\n    ')
       .replace(/ \}/g, '\n  }')
    );
  });
"
