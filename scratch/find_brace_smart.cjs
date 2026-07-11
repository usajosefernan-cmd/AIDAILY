const fs = require('fs');
const code = fs.readFileSync('/home/ubuntu/workspace/AIDAILY/backups/v2.4/index.astro', 'utf8');
const initIdx = code.indexOf('async function init()');
let braceCount = 0;
let foundOpen = false;
let lineNum = 1;
let inString = null;
let inComment = false;
for (let i = initIdx; i < code.length; i++) {
  const char = code[i];
  if (char === '\n') lineNum++;
  
  if (inComment) {
    if (inComment === '//' && char === '\n') {
      inComment = false;
    } else if (inComment === '/*' && char === '*' && code[i+1] === '/') {
      inComment = false;
      i++;
    }
    continue;
  }
  
  if (inString) {
    if (char === inString && code[i-1] !== '\\') {
      inString = null;
    }
    continue;
  }
  
  if (char === '/' && code[i+1] === '/') {
    inComment = '//';
    i++;
    continue;
  }
  if (char === '/' && code[i+1] === '*') {
    inComment = '/*';
    i++;
    continue;
  }
  
  if (char === '  || char === "  || char === '') {
 inString = char;
 continue;
 }
 
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
