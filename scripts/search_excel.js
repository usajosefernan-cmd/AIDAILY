import XLSX from 'xlsx';

const excelPath = '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';

function main() {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Total filas:', data.length);
  
  // Buscar palabras clave como "ONLINE", "Activa", "Sí", "No", en las columnas
  const sample = data.slice(0, 10);
  console.log('Muestra de 2 filas:', JSON.stringify(sample.slice(0, 2), null, 2));

  // Contar cuántas tienen ciertos valores en Notas Técnicas o alguna columna
  const counts = {};
  data.forEach((row, idx) => {
    Object.keys(row).forEach(key => {
      const val = String(row[key]);
      if (val.includes('ONLINE') || val.includes('ONLINE') || val.includes('ONLINE')) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
  });
  console.log('Frecuencia de ONLINE por columna:', counts);
}

main();
