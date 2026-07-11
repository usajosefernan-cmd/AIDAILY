import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/sync-aidaily.sh';
const code = fs.readFileSync(filePath, 'utf8');

let doubleQuotes = [];
let singleQuotes = [];
let backticks = [];

let inDouble = false;
let inSingle = false;
let inBacktick = false;

let escaped = false;

for (let i = 0; i < code.length; i++) {
  const char = code[i];
  
  if (escaped) {
    escaped = false;
    continue;
  }
  
  if (char === '\\') {
    escaped = true;
    continue;
  }
  
  if (char === '"' && !inSingle) {
    inDouble = !inDouble;
    if (inDouble) {
      doubleQuotes.push(i);
    } else {
      doubleQuotes.pop();
    }
  }
  
  if (char === "'" && !inDouble) {
    inSingle = !inSingle;
    if (inSingle) {
      singleQuotes.push(i);
    } else {
      singleQuotes.pop();
    }
  }
  
  if (char === '`' && !inSingle) {
    inBacktick = !inBacktick;
    if (inBacktick) {
      backticks.push(i);
    } else {
      backticks.pop();
    }
  }
}

function getLineAndCol(pos) {
  const sub = code.substring(0, pos);
  const lines = sub.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

if (doubleQuotes.length > 0) {
  const loc = getLineAndCol(doubleQuotes[0]);
  console.log(`❌ Comilla doble desbalanceada en Línea ${loc.line}, Col ${loc.col}`);
}
if (singleQuotes.length > 0) {
  const loc = getLineAndCol(singleQuotes[0]);
  console.log(`❌ Comilla simple desbalanceada en Línea ${loc.line}, Col ${loc.col}`);
}
if (backticks.length > 0) {
  const loc = getLineAndCol(backticks[0]);
  console.log(`❌ Backtick desbalanceado en Línea ${loc.line}, Col ${loc.col}`);
}

if (doubleQuotes.length === 0 && singleQuotes.length === 0 && backticks.length === 0) {
  console.log('✅ Sintaxis de comillas balanceada con éxito.');
}
