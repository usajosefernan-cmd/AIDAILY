import XLSX from 'xlsx';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  console.log('Hojas del Excel:', workbook.SheetNames);
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Hoja: "${name}". Filas: ${data.length}`);
    if (data.length > 0) {
      console.log(`Columnas de "${name}":`, Object.keys(data[0]));
    }
  });
}

main();
