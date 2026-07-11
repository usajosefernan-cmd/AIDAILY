import XLSX from 'xlsx';

const excelPath = './directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Total rows:', data.length);
  
  const keywords = ['ciclismo', 'cycling', 'motogp', 'moto', 'motor'];
  const matches = [];

  data.forEach((row, idx) => {
    let found = false;
    let matchWord = '';
    Object.values(row).forEach(val => {
      const s = String(val).toLowerCase();
      keywords.forEach(kw => {
        if (s.includes(kw)) {
          found = true;
          matchWord = kw;
        }
      });
    });
    if (found) {
      matches.push({ index: idx, row, keyword: matchWord });
    }
  });

  console.log(`Found ${matches.length} matching rows:`);
  matches.forEach(m => {
    console.log(`Row ${m.index} (keyword: ${m.keyword}):`, JSON.stringify(m.row, null, 2));
  });
}

main();
