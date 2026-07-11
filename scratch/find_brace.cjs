const fs = require('fs');
const code = fs.readFileSync('/home/ubuntu/workspace/AIDAILY/backups/v2.4/index.astro', 'utf8');
const initIdx = code.indexOf('async function init()');
if (initIdx === -1) { console.log('init not found'); process.exit(); }
let braceCount = 0;
let foundOpen = false;
let lineNum = 1;
for (let i = initIdx; i < code.length; i++) {
  const char = code[i];
  if (char === '\n') lineNum++;
  if (char === '{') {
    braceCount++;
    foundOpen = true;
  } else if (char === '}') {
    braceCount--;
  }
  if (foundOpen && braceCount === 0) {
    console.log('init closes at character index:', i, 'line:', lineNum);
    break;
  }
}
