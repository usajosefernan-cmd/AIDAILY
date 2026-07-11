import XLSX from 'xlsx';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  const cats = new Set();
  const subs = new Set();
  
  data.forEach(row => {
    if (row['Categoría General']) cats.add(row['Categoría General']);
    if (row['Subcategoría Independiente']) subs.add(row['Subcategoría Independiente']);
  });
  
  console.log("=== CATEGORÍAS GENERALES ÚNICAS ===");
  console.log(Array.from(cats));
  console.log("\n=== SUBCATEGORÍAS INDEPENDIENTES ÚNICAS (MUESTRA 30) ===");
  console.log(Array.from(subs).slice(0, 30));
}

main();
