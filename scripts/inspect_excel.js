import XLSX from 'xlsx';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log("=== CLAVES DE LA PRIMERA FILA ===");
  if (data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log("=== PRIMERA FILA COMPLETA ===");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("No hay filas.");
  }
}

main();
