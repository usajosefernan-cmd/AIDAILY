import XLSX from 'xlsx';
import fs from 'fs';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function inspect() {
  console.log(`Comprobando existencia de Excel en ${excelPath}...`);
  if (!fs.existsSync(excelPath)) {
    console.error(`El archivo Excel no existe.`);
    return;
  }
  
  try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Excel leido con éxito. Hoja: "${sheetName}". Total de filas: ${data.length}`);
    if (data.length > 0) {
      console.log(`Primeras 3 filas del Excel:`, JSON.stringify(data.slice(0, 3), null, 2));
      console.log(`Últimas 3 filas del Excel:`, JSON.stringify(data.slice(-3), null, 2));
    }
  } catch (err) {
    console.error(`Error leyendo el Excel:`, err);
  }
}

inspect();
