import XLSX from 'xlsx';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Total filas:', data.length);
  const withOnline = data.filter(r => {
    return Object.values(r).some(v => String(v).includes('ONLINE'));
  });
  console.log('Filas con ONLINE:', withOnline.length);
  if (withOnline.length > 0) {
    console.log('Ejemplo de fila con ONLINE:', JSON.stringify(withOnline[0], null, 2));
  }
}

main();
