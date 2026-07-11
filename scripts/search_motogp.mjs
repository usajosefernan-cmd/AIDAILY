import XLSX from 'xlsx';

const excelPath = './directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  const keywords = ['motogp', 'moto gp', 'motorcycle', 'motociclismo'];
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

  console.log(`Found ${matches.length} matching rows for MotoGP:`);
  matches.forEach(m => {
    console.log(`Row ${m.index}:`, JSON.stringify(m.row, null, 2));
  });
}

main();
