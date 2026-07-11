import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const excelPath = './directorio_fuentes.xlsx';

const feeds = [
  // INTERNACIONAL
  { medio: 'El País Internacional', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada', cat: 'Internacional', subcat: 'Europa', prio: 3.0 },
  { medio: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', cat: 'Internacional', subcat: 'América', prio: 2.5 },
  
  // NACIONAL
  { medio: 'El País España', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada', cat: 'Nacional', subcat: 'Política', prio: 3.0 },
  { medio: 'El Mundo Portada', url: 'https://e00-elmundo.uecdn.es/elmun/rss/portada.xml', cat: 'Nacional', subcat: 'Política', prio: 2.8 },
  { medio: 'RTVE Nacional', url: 'https://www.rtve.es/rss/noticias_espana.xml', cat: 'Nacional', subcat: 'Política', prio: 2.5 },
  { medio: 'ABC España', url: 'https://www.abc.es/rss/2.0/espana/', cat: 'Nacional', subcat: 'Actualidad', prio: 2.5 },
  
  // ECONOMIA
  { medio: 'Cinco Días', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/portada', cat: 'Economía', subcat: 'Finanzas', prio: 2.8 },
  { medio: 'El Economista', url: 'https://www.eleconomista.es/rss/rss-portada.php', cat: 'Economía', subcat: 'Empresas', prio: 2.5 },
  
  // CIENCIA
  { medio: 'El País Ciencia', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada', cat: 'Ciencia', subcat: 'Biología', prio: 2.8 },
  { medio: 'Nature', url: 'https://www.nature.com/nature.rss', cat: 'Ciencia', subcat: 'Espacio', prio: 3.0 },
  { medio: 'Agencia SINC', url: 'https://www.agenciasinc.es/rss', cat: 'Ciencia', subcat: 'Biología', prio: 2.5 },
  { medio: 'RTVE Ciencia', url: 'https://www.rtve.es/rss/temas_ciencia.xml', cat: 'Ciencia', subcat: 'Biología', prio: 2.0 },
  
  // TECNOLOGIA
  { medio: 'Xataka', url: 'https://www.xataka.com/rss', cat: 'Tecnología', subcat: 'Gadgets', prio: 3.0 },
  { medio: 'Genbeta', url: 'https://www.genbeta.com/rss', cat: 'Tecnología', subcat: 'Software', prio: 2.8 },
  { medio: 'TechCrunch', url: 'https://techcrunch.com/feed/', cat: 'Tecnología', subcat: 'IA', prio: 3.0 },
  
  // CULTURA
  { medio: 'El País Cultura', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', cat: 'Cultura', subcat: 'Arte', prio: 2.5 },
  { medio: 'Jot Down', url: 'https://www.jotdown.es/feed/', cat: 'Cultura', subcat: 'Letras', prio: 2.2 },
  
  // ESTILO
  { medio: 'El País Sociedad (Estilo)', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/portada', cat: 'Estilo', subcat: 'Vida', prio: 2.2 },
  { medio: 'Muy Interesante', url: 'https://www.muyinteresante.es/rss', cat: 'Estilo', subcat: 'Salud', prio: 2.5 },
  { medio: 'GQ España', url: 'https://www.revistagq.com/feed/rss', cat: 'Estilo', subcat: 'Moda', prio: 2.0 },
  
  // DEPORTES
  { medio: 'Marca', url: 'https://www.marca.com/rss/portada.xml', cat: 'Deportes', subcat: 'Fútbol - LaLiga EA Sports', prio: 3.0 },
  { medio: 'AS', url: 'https://as.com/rss/feed.xml', cat: 'Deportes', subcat: 'Fútbol - LaLiga EA Sports', prio: 2.8 },
  { medio: 'Ciclismo a Fondo', url: 'https://ciclismoafondo.es/feed/', cat: 'Deportes', subcat: 'Ciclismo', prio: 2.2 },
  { medio: 'Motorsport F1', url: 'https://www.motorsport.com/f1/rss/', cat: 'Deportes', subcat: 'Motor - Fórmula 1', prio: 2.5 },
  
  // OPINION
  { medio: 'El País Opinión', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/opinion/portada', cat: 'Opinión', subcat: 'Análisis', prio: 2.8 },
  { medio: 'El Mundo Opinión', url: 'https://e00-elmundo.uecdn.es/elmun/rss/opinion.xml', cat: 'Opinión', subcat: 'Editorial', prio: 2.5 },
  { medio: 'El Diario Opinión', url: 'https://www.eldiario.es/rss/opinion/', cat: 'Opinión', subcat: 'Columnistas', prio: 2.5 },
  { medio: 'ABC Opinión', url: 'https://www.abc.es/rss/2.0/opinion/', cat: 'Opinión', subcat: 'Análisis', prio: 2.2 },
  
  // MEDIOAMBIENTE
  { medio: 'El País Clima y Medio Ambiente', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/clima-y-medio-ambiente/portada', cat: 'Medio Ambiente', subcat: 'Clima', prio: 2.8 },
  { medio: 'EFE Verde', url: 'https://efeverde.com/feed/', cat: 'Medio Ambiente', subcat: 'Ecología', prio: 2.5 },
  
  // SOCIEDAD
  { medio: 'El País Sociedad', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/portada', cat: 'Sociedad', subcat: 'Educación', prio: 2.5 },
  { medio: 'El Diario Sociedad', url: 'https://www.eldiario.es/rss/sociedad/', cat: 'Sociedad', subcat: 'Derechos', prio: 2.5 },
  
  // GASTRONOMIA
  { medio: 'El Comidista', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/elcomidista/portada', cat: 'Gastronomía', subcat: 'Recetas', prio: 2.5 },
  { medio: 'Directo al Paladar', url: 'https://www.directoalpaladar.com/feed/', cat: 'Gastronomía', subcat: 'Cocina', prio: 2.2 },
  { medio: 'El Diario Gastronomía', url: 'https://www.eldiario.es/rss/consumoclaro/gastronomia/', cat: 'Gastronomía', subcat: 'Alimentación', prio: 2.2 },
  { medio: 'RTVE Cocina', url: 'https://www.rtve.es/rss/recetas.xml', cat: 'Gastronomía', subcat: 'Recetas', prio: 2.0 }
];

function run() {
  console.log(`[Excel Creator] Generando lista estructurada de 36 feeds...`);
  
  // Formatear filas para el Excel
  const rows = feeds.map(f => ({
    'MEDIO': f.medio,
    'URL': f.url,
    'Categoría': f.cat,
    'Subcategoría': f.subcat,
    'Prioridad': f.prio
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fuentes');

  // Guardar archivo Excel
  XLSX.writeFile(workbook, excelPath);
  console.log(`[Excel Creator] Archivo Excel guardado con éxito en: ${excelPath}`);
}

run();
