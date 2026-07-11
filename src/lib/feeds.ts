export interface FeedConfig {
  name: string;
  url: string;
  filterCategory?: boolean;
  category: string;
  tags: string[];
  priority?: number;
}

export const FEED_MATRIX: Record<string, FeedConfig[]> = {
  // ==========================================
  // RAMA: INTERNACIONAL
  // ==========================================
  internacional: [
    { name: 'El País Internacional', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada', category: 'news', tags: ['internacional', 'europa', 'ue'], priority: 3.0 },
    { name: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', category: 'news', tags: ['internacional', 'america', 'latam'], priority: 2.5 }
  ],

  // ==========================================
  // RAMA: NACIONAL
  // ==========================================
  nacional: [
    { name: 'El País España', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada', category: 'news', tags: ['nacional', 'politica'], priority: 3.0 },
    { name: 'El Mundo Portada', url: 'https://e00-elmundo.uecdn.es/elmun/rss/portada.xml', category: 'news', tags: ['nacional', 'politica'], priority: 2.8 },
    { name: 'RTVE Nacional', url: 'https://www.rtve.es/rss/noticias_espana.xml', category: 'news', tags: ['nacional', 'politica'], priority: 2.5 },
    { name: 'ABC España', url: 'https://www.abc.es/rss/2.0/espana/', category: 'news', tags: ['nacional', 'actualidad'], priority: 2.5 }
  ],

  // ==========================================
  // RAMA: ECONOMIA
  // ==========================================
  economia: [
    { name: 'Cinco Días', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/portada', category: 'news', tags: ['economia', 'finanzas'], priority: 2.8 },
    { name: 'El Economista', url: 'https://www.eleconomista.es/rss/rss-portada.php', category: 'news', tags: ['economia', 'empresas'], priority: 2.5 }
  ],

  // ==========================================
  // RAMA: CIENCIA
  // ==========================================
  ciencia: [
    { name: 'El País Ciencia', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada', category: 'research', tags: ['ciencia', 'biologia'], priority: 2.8 },
    { name: 'Nature', url: 'https://www.nature.com/nature.rss', category: 'research', tags: ['ciencia', 'espacio'], priority: 3.0 },
    { name: 'Agencia SINC', url: 'https://www.agenciasinc.es/rss', category: 'news', tags: ['ciencia', 'biologia'], priority: 2.5 },
    { name: 'RTVE Ciencia', url: 'https://www.rtve.es/rss/temas_ciencia.xml', category: 'news', tags: ['ciencia', 'biologia'], priority: 2.0 }
  ],

  // ==========================================
  // RAMA: TECNOLOGIA
  // ==========================================
  tecnologia: [
    { name: 'Xataka', url: 'https://www.xataka.com/rss', category: 'news', tags: ['tecnologia', 'gadgets'], priority: 3.0 },
    { name: 'Genbeta', url: 'https://www.genbeta.com/rss', category: 'news', tags: ['tecnologia', 'software'], priority: 2.8 },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'business', tags: ['tecnologia', 'ia', 'llms'], priority: 3.0 }
  ],

  // ==========================================
  // RAMA: CULTURA
  // ==========================================
  cultura: [
    { name: 'El País Cultura', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', category: 'news', tags: ['cultura', 'arte'], priority: 2.5 },
    { name: 'Jot Down', url: 'https://www.jotdown.es/feed/', category: 'news', tags: ['cultura', 'letras'], priority: 2.2 }
  ],

  // ==========================================
  // RAMA: ESTILO
  // ==========================================
  estilo: [
    { name: 'El País Sociedad', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/portada', category: 'news', tags: ['estilo', 'vida'], priority: 2.2 },
    { name: 'Muy Interesante', url: 'https://www.muyinteresante.es/rss', category: 'news', tags: ['estilo', 'salud'], priority: 2.5 },
    { name: 'GQ España', url: 'https://www.revistagq.com/feed/rss', category: 'news', tags: ['estilo', 'moda'], priority: 2.0 }
  ],

  // ==========================================
  // RAMA: DEPORTES
  // ==========================================
  deportes: [
    { name: 'Marca - Tour de Francia', url: 'https://e00-marca.uecdn.es/rss/ciclismo/tour-de-francia.xml', category: 'news', tags: ['deportes', 'ciclismo/tour-de-francia'], priority: 3.0 },
    { name: 'AS - Tour de Francia', url: 'https://as.com/rss/ciclismo/tour_francia/portada.xml', category: 'news', tags: ['deportes', 'ciclismo/tour-de-francia'], priority: 3.0 },
    { name: 'Mundo Deportivo - Tour de Francia', url: 'https://www.mundodeportivo.com/rss/ciclismo/tour-francia.xml', category: 'news', tags: ['deportes', 'ciclismo/tour-de-francia'], priority: 2.8 },
    { name: 'Zikloland', url: 'https://www.zikloland.com/feed/', category: 'news', tags: ['deportes', 'ciclismo/tour-de-francia'], priority: 2.8 },
    { name: 'Ciclismo Internacional', url: 'https://www.ciclismointernacional.com/feed/', category: 'news', tags: ['deportes', 'ciclismo/tour-de-francia'], priority: 2.8 },
    { name: 'Eurosport - Ciclismo', url: 'https://espanol.eurosport.com/ciclismo/rss.xml', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.5 },
    { name: 'Velo Outside', url: 'https://velo.outsideonline.com/feed', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.5 },
    { name: 'CyclingUpToDate', url: 'https://cyclinguptodate.com/feed', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.5 },
    { name: 'Marca', url: 'https://www.marca.com/rss/portada.xml', category: 'news', tags: ['deportes', 'futbol', 'laliga'], priority: 3.0 },
    { name: 'AS', url: 'https://as.com/rss/feed.xml', category: 'news', tags: ['deportes', 'futbol', 'laliga'], priority: 2.8 },
    { name: 'Ciclismo a Fondo', url: 'https://www.ciclismoafondo.es/feed/', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.2 },
    { name: 'Motorsport F1', url: 'https://www.motorsport.com/f1/rss/', category: 'news', tags: ['deportes', 'motor', 'f1'], priority: 2.5 },
    { name: 'Crash.net MotoGP', url: 'https://www.crash.net/rss/motogp', category: 'news', tags: ['deportes', 'motor/motogp'], priority: 2.5 },
    { name: 'Todocircuito MotoGP', url: 'https://www.todocircuito.com/rss.xml', category: 'news', tags: ['deportes', 'motor/motogp'], priority: 2.5 },
    { name: 'GPone MotoGP', url: 'https://www.gpone.com/en/rss', category: 'news', tags: ['deportes', 'motor/motogp'], priority: 2.2 },
    { name: 'Esciclismo', url: 'https://www.esciclismo.com/feed/', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.5 },
    { name: 'Cyclingnews', url: 'https://www.cyclingnews.com/rss', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.5 },
    { name: 'SpazioCiclismo Italy', url: 'https://cyclingpro.net/spaziociclismo/feed/', category: 'news', tags: ['deportes', 'ciclismo'], priority: 2.2 }
  ],

  // ==========================================
  // RAMA: OPINION
  // ==========================================
  opinion: [
    { name: 'El País Opinión', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/opinion/portada', category: 'news', tags: ['opinion', 'analisis'], priority: 2.8 },
    { name: 'El Mundo Opinión', url: 'https://e00-elmundo.uecdn.es/elmun/rss/opinion.xml', category: 'news', tags: ['opinion', 'editorial'], priority: 2.5 },
    { name: 'El Diario Opinión', url: 'https://www.eldiario.es/rss/opinion/', category: 'news', tags: ['opinion', 'columnistas'], priority: 2.5 },
    { name: 'ABC Opinión', url: 'https://www.abc.es/rss/2.0/opinion/', category: 'news', tags: ['opinion', 'analisis'], priority: 2.2 }
  ],

  // ==========================================
  // RAMA: MEDIO AMBIENTE
  // ==========================================
  medioambiente: [
    { name: 'El País Clima y Medio Ambiente', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/clima-y-medio-ambiente/portada', category: 'news', tags: ['medioambiente', 'sostenibilidad'], priority: 2.8 },
    { name: 'EFE Verde', url: 'https://efeverde.com/feed/', category: 'news', tags: ['medioambiente', 'ecologia'], priority: 2.5 }
  ],

  // ==========================================
  // RAMA: SOCIEDAD
  // ==========================================
  sociedad: [
    { name: 'El País Sociedad', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/portada', category: 'news', tags: ['sociedad', 'educacion'], priority: 2.5 },
    { name: 'El Diario Sociedad', url: 'https://www.eldiario.es/rss/sociedad/', category: 'news', tags: ['sociedad', 'derechos'], priority: 2.5 }
  ],

  // ==========================================
  // RAMA: GASTRONOMIA
  // ==========================================
  gastronomia: [
    { name: 'El Comidista', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/elcomidista/portada', category: 'news', tags: ['gastronomia', 'recetas'], priority: 2.5 },
    { name: 'Directo al Paladar', url: 'https://www.directoalpaladar.com/feed/', category: 'news', tags: ['gastronomia', 'cocina'], priority: 2.2 },
    { name: 'El Diario Gastronomía', url: 'https://www.eldiario.es/rss/consumoclaro/gastronomia/', category: 'news', tags: ['gastronomia', 'alimentacion'], priority: 2.2 },
    { name: 'RTVE Cocina', url: 'https://www.rtve.es/rss/recetas.xml', category: 'news', tags: ['gastronomia', 'recetas'], priority: 2.0 }
  ]
};

export interface CategoryNode {
  title: string;
  icon: string;
  key: string;
  children?: CategoryNode[];
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    title: 'Internacional',
    icon: '🌐',
    key: 'internacional',
    children: [
      {
        title: 'Europa',
        icon: '🇪🇺',
        key: 'internacional/europa',
        children: [
          { title: 'Unión Europea', icon: '🇪🇺', key: 'internacional/europa/ue' },
          { title: 'General', icon: '📰', key: 'internacional/europa/general' }
        ]
      },
      {
        title: 'América',
        icon: '🌎',
        key: 'internacional/america',
        children: [
          { title: 'EE.UU.', icon: '🇺🇸', key: 'internacional/america/eeuu' },
          { title: 'Latinoamérica', icon: '🌎', key: 'internacional/america/latam' },
          { title: 'General', icon: '📰', key: 'internacional/america/general' }
        ]
      },
      { title: 'Asia', icon: '🌏', key: 'internacional/asia' },
      { title: 'Conflictos', icon: '⚔️', key: 'internacional/conflictos' },
      { title: 'Política Exterior', icon: '🏛️', key: 'internacional/politica exterior' }
    ]
  },
  {
    title: 'Nacional',
    icon: '🏛️',
    key: 'nacional',
    children: [
      { title: 'Política', icon: '🏛️', key: 'nacional/politica' },
      { title: 'Sociedad', icon: '👥', key: 'nacional/sociedad' },
      { title: 'Justicia', icon: '⚖️', key: 'nacional/justicia' },
      { title: 'Economía Nacional', icon: '📊', key: 'nacional/economia nacional' },
      { title: 'Comunidades', icon: '🇪🇸', key: 'nacional/comunidades' },
      { title: 'Corrupción', icon: '🔍', key: 'nacional/corrupcion' }
    ]
  },
  {
    title: 'Economía',
    icon: '📊',
    key: 'economia',
    children: [
      { title: 'Mercados', icon: '📈', key: 'economia/mercados' },
      { title: 'Finanzas', icon: '💰', key: 'economia/finanzas' },
      { title: 'Empresas', icon: '🏢', key: 'economia/empresas' },
      { title: 'Macroeconomía', icon: '📊', key: 'economia/macroeconomia' },
      { title: 'Empleo', icon: '💼', key: 'economia/empleo' },
      { title: 'Negocios', icon: '🤝', key: 'economia/negocios' }
    ]
  },
  {
    title: 'Opinión',
    icon: '✍️',
    key: 'opinion',
    children: [
      { title: 'Editorial', icon: '✍️', key: 'opinion/editorial' },
      { title: 'Columnistas', icon: '✒️', key: 'opinion/columnas' },
      { title: 'Análisis', icon: '🔍', key: 'opinion/analisis' },
      { title: 'Debates', icon: '🗣️', key: 'opinion/debates' }
    ]
  },
  {
    title: 'Tecnología',
    icon: '🤖',
    key: 'tecnologia',
    children: [
      {
        title: 'Inteligencia Artificial',
        icon: '🧠',
        key: 'tecnologia/ia',
        children: [
          { title: 'LLMs & Modelos', icon: '🤖', key: 'tecnologia/ia/llms' },
          { title: 'Desarrollo & APIs', icon: '💻', key: 'tecnologia/ia/desarrollo' },
          { title: 'General', icon: '🧠', key: 'tecnologia/ia/general' }
        ]
      },
      { title: 'Software', icon: '💻', key: 'tecnologia/software' },
      { title: 'Hardware', icon: '🔌', key: 'tecnologia/hardware' },
      { title: 'Startups', icon: '🚀', key: 'tecnologia/startups' },
      { title: 'Ciberseguridad', icon: '🔒', key: 'tecnologia/ciberseguridad' },
      { title: 'Gadgets', icon: '📱', key: 'tecnologia/gadgets' },
      { title: 'Videojuegos', icon: '🎮', key: 'tecnologia/videojuegos' },
      { title: 'Coches Eléctricos', icon: '⚡', key: 'tecnologia/coches electricos' }
    ]
  },
  {
    title: 'Ciencia',
    icon: '🔬',
    key: 'ciencia',
    children: [
      { title: 'Espacio', icon: '🚀', key: 'ciencia/espacio' },
      { title: 'Salud', icon: '🏥', key: 'ciencia/salud' },
      { title: 'Biología', icon: '🧬', key: 'ciencia/biologia' },
      { title: 'Biotecnología', icon: '🧬', key: 'ciencia/biotecnologia' },
      { title: 'Física', icon: '⚛️', key: 'ciencia/fisica' },
      { title: 'Descubrimientos', icon: '💡', key: 'ciencia/descubrimientos' },
      { title: 'Astronomía', icon: '🔭', key: 'ciencia/astronomia' }
    ]
  },
  {
    title: 'Medio Ambiente',
    icon: '🌲',
    key: 'medioambiente',
    children: [
      { title: 'Clima', icon: '☀️', key: 'medioambiente/clima' },
      { title: 'Sostenibilidad', icon: '♻️', key: 'medioambiente/sostenibilidad' },
      { title: 'Ecología', icon: '🌱', key: 'medioambiente/ecologia' },
      { title: 'Energías Renovables', icon: '☀️', key: 'medioambiente/energias renovables' },
      { title: 'Biodiversidad', icon: '🐾', key: 'medioambiente/biodiversidad' },
      { title: 'Economía Circular', icon: '🔄', key: 'medioambiente/economia circular' }
    ]
  },
  {
    title: 'Cultura',
    icon: '🎬',
    key: 'cultura',
    children: [
      { title: 'Cine', icon: '🎬', key: 'cultura/cine' },
      { title: 'Música', icon: '🎵', key: 'cultura/musica' },
      { title: 'Literatura', icon: '📚', key: 'cultura/literatura' },
      { title: 'Arte', icon: '🎨', key: 'cultura/arte' },
      { title: 'Teatro', icon: '🎭', key: 'cultura/teatro' },
      { title: 'Series / TV', icon: '📺', key: 'cultura/series' }
    ]
  },
  {
    title: 'Deportes',
    icon: '⚽',
    key: 'deportes',
    children: [
      {
        title: 'Fútbol',
        icon: '⚽',
        key: 'deportes/futbol',
        children: [
          { title: 'LaLiga EA Sports', icon: '🏆', key: 'deportes/futbol/laliga' },
          { title: 'Femenino', icon: '👩', key: 'deportes/futbol/femenino' },
          { title: 'Champions League', icon: '🇪🇺', key: 'deportes/futbol/champions' },
          { title: 'Segunda División', icon: '🥈', key: 'deportes/futbol/2' },
          { title: 'General', icon: '⚽', key: 'deportes/futbol/general' }
        ]
      },
      { title: 'Tour de Francia', icon: '🚴🇫🇷', key: 'deportes/ciclismo/tour-de-francia' },
      { title: 'Ciclismo', icon: '🚴', key: 'deportes/ciclismo' },
      {
        title: 'Motor',
        icon: '🏎️',
        key: 'deportes/motor',
        children: [
          { title: 'Fórmula 1', icon: '🏎️', key: 'deportes/motor/f1' },
          { title: 'MotoGP', icon: '🏍️', key: 'deportes/motor/motogp' },
          { title: 'General', icon: '🏎️', key: 'deportes/motor/general' }
        ]
      },
      { title: 'Baloncesto', icon: '🏀', key: 'deportes/baloncesto' },
      { title: 'Tenis', icon: '🎾', key: 'deportes/tenis' },
      { title: 'Polideportivo', icon: '🏆', key: 'deportes/polideportivo' }
    ]
  },
  {
    title: 'Estilo de Vida',
    icon: '🌱',
    key: 'estilo',
    children: [
      { title: 'Bienestar', icon: '🧘', key: 'estilo/bienestar' },
      { title: 'Viajes', icon: '✈️', key: 'estilo/viajes' },
      { title: 'Tendencias', icon: '✨', key: 'estilo/tendencias' },
      { title: 'Moda', icon: '👗', key: 'estilo/moda' },
      { title: 'Hogar', icon: '🏠', key: 'estilo/hogar' }
    ]
  },
  {
    title: 'Sociedad',
    icon: '👥',
    key: 'sociedad',
    children: [
      { title: 'Educación', icon: '🏫', key: 'sociedad/educacion' },
      { title: 'Sanidad', icon: '🏥', key: 'sociedad/sanidad' },
      { title: 'Derechos Humanos', icon: '⚖️', key: 'sociedad/derechos humanos' },
      { title: 'Igualdad', icon: '🤝', key: 'sociedad/igualdad' },
      { title: 'Redes Sociales', icon: '📱', key: 'sociedad/redes sociales' },
      { title: 'Meteorología', icon: '⛈️', key: 'sociedad/meteorologia' }
    ]
  },
  {
    title: 'Gastronomía',
    icon: '🍳',
    key: 'gastronomia',
    children: [
      { title: 'Recetas', icon: '🍳', key: 'gastronomia/recetas' },
      { title: 'Restaurantes', icon: '🍽️', key: 'gastronomia/restaurantes' },
      { title: 'Nutrición', icon: '🥗', key: 'gastronomia/nutricion' },
      { title: 'Vinos', icon: '🍷', key: 'gastronomia/vinos' },
      { title: 'Cocina', icon: '🍳', key: 'gastronomia/cocina' },
      { title: 'Alimentación', icon: '🍎', key: 'gastronomia/alimentacion' }
    ]
  }
];

export const CATEGORY_META: Record<string, { title: string; description: string; icon: string; parent?: string }> = {
  internacional: { title: 'Internacional', description: 'Actualidad mundial, geopolítica y noticias internacionales', icon: '🌐' },
  'internacional/europa': { title: 'Europa', description: 'Noticias del continente europeo', icon: '🇪🇺', parent: 'internacional' },
  'internacional/europa/ue': { title: 'Unión Europea', description: 'Actualidad en la UE', icon: '🇪🇺', parent: 'internacional/europa' },
  'internacional/europa/general': { title: 'Europa General', description: 'Otras noticias de Europa', icon: '📰', parent: 'internacional/europa' },
  'internacional/america': { title: 'América', description: 'Actualidad en el continente americano', icon: '🌎', parent: 'internacional' },
  'internacional/america/eeuu': { title: 'EE.UU.', description: 'Noticias de Estados Unidos', icon: '🇺🇸', parent: 'internacional/america' },
  'internacional/america/latam': { title: 'Latinoamérica', description: 'Noticias del continente latinoamericano', icon: '🌎', parent: 'internacional/america' },
  'internacional/america/general': { title: 'América General', description: 'Otras noticias de América', icon: '📰', parent: 'internacional/america' },
  'internacional/asia': { title: 'Asia', description: 'Noticias y actualidad del continente asiático', icon: '🌏', parent: 'internacional' },
  'internacional/conflictos': { title: 'Conflictos', description: 'Tensiones geopolíticas y zonas de conflicto', icon: '⚔️', parent: 'internacional' },
  'internacional/politica exterior': { title: 'Política Exterior', description: 'Relaciones internacionales', icon: '🏛️', parent: 'internacional' },
  
  nacional: { title: 'Nacional', description: 'Noticias nacionales, política, economía y debates sociales', icon: '🏛️' },
  'nacional/politica': { title: 'Política', description: 'Política nacional', icon: '🏛️', parent: 'nacional' },
  'nacional/sociedad': { title: 'Sociedad', description: 'Temas sociales nacionales', icon: '👥', parent: 'nacional' },
  'nacional/justicia': { title: 'Justicia', description: 'Tribunales y poder judicial', icon: '⚖️', parent: 'nacional' },
  'nacional/economia nacional': { title: 'Economía Nacional', description: 'Mercado doméstico', icon: '📊', parent: 'nacional' },
  'nacional/comunidades': { title: 'Comunidades', description: 'Actualidad de las CC.AA.', icon: '🇪🇸', parent: 'nacional' },
  'nacional/corrupcion': { title: 'Corrupción', description: 'Investigaciones y debates', icon: '🔍', parent: 'nacional' },

  economia: { title: 'Economía', description: 'Finanzas, mercados, macroeconomía, negocios y empresas', icon: '📊' },
  'economia/mercados': { title: 'Mercados', description: 'Bolsas y valores', icon: '📈', parent: 'economia' },
  'economia/finanzas': { title: 'Finanzas', description: 'Finanzas personales y globales', icon: '💰', parent: 'economia' },
  'economia/empresas': { title: 'Empresas', description: 'Actualidad corporativa', icon: '🏢', parent: 'economia' },
  'economia/macroeconomia': { title: 'Macroeconomía', description: 'Cifras y análisis global', icon: '📊', parent: 'economia' },
  'economia/empleo': { title: 'Empleo', description: 'Mercado laboral', icon: '💼', parent: 'economia' },
  'economia/negocios': { title: 'Negocios', description: 'Emprendimiento y comercio', icon: '🤝', parent: 'economia' },

  opinion: { title: 'Opinión', description: 'Columnas, análisis y editorial de opinión', icon: '✍️' },
  'opinion/editorial': { title: 'Editorial', description: 'Postura oficial de los medios', icon: '✍️', parent: 'opinion' },
  'opinion/columnas': { title: 'Columnistas', description: 'Firmas invitadas', icon: '✒️', parent: 'opinion' },
  'opinion/analisis': { title: 'Análisis', description: 'Lecturas en profundidad', icon: '🔍', parent: 'opinion' },
  'opinion/debates': { title: 'Debates', description: 'Controversias de actualidad', icon: '🗣️', parent: 'opinion' },

  tecnologia: { title: 'Tecnología', description: 'Inteligencia artificial, desarrollo de software, gadgets y futuro digital', icon: '🤖' },
  'tecnologia/ia': { title: 'IA', description: 'Inteligencia artificial, LLMs y redes neuronales', icon: '🧠', parent: 'tecnologia' },
  'tecnologia/ia/llms': { title: 'LLMs & Modelos', description: 'Modelos de lenguaje y arquitectura', icon: '🤖', parent: 'tecnologia/ia' },
  'tecnologia/ia/desarrollo': { title: 'Desarrollo & APIs', description: 'Integración práctica de IA', icon: '💻', parent: 'tecnologia/ia' },
  'tecnologia/ia/general': { title: 'IA General', description: 'Otras noticias de IA', icon: '🧠', parent: 'tecnologia/ia' },
  'tecnologia/software': { title: 'Software', description: 'Desarrollo, lenguajes de programación y aplicaciones', icon: '💻', parent: 'tecnologia' },
  'tecnologia/hardware': { title: 'Hardware', description: 'Componentes y procesadores', icon: '🔌', parent: 'tecnologia' },
  'tecnologia/startups': { title: 'Startups', description: 'Nuevas empresas tecnológicas', icon: '🚀', parent: 'tecnologia' },
  'tecnologia/ciberseguridad': { title: 'Ciberseguridad', description: 'Seguridad informática', icon: '🔒', parent: 'tecnologia' },
  'tecnologia/gadgets': { title: 'Gadgets', description: 'Dispositivos, móviles y hardware de consumo', icon: '📱', parent: 'tecnologia' },
  'tecnologia/videojuegos': { title: 'Videojuegos', description: 'Industria gaming', icon: '🎮', parent: 'tecnologia' },
  'tecnologia/coches electricos': { title: 'Coches Eléctricos', description: 'Movilidad sostenible', icon: '⚡', parent: 'tecnologia' },

  ciencia: { title: 'Ciencia', description: 'Investigación científica, medicina, descubrimientos y espacio', icon: '🔬' },
  'ciencia/espacio': { title: 'Espacio', description: 'Astronomía y exploración espacial', icon: '🚀', parent: 'ciencia' },
  'ciencia/salud': { title: 'Salud', description: 'Medicina y salud pública', icon: '🏥', parent: 'ciencia' },
  'ciencia/biologia': { title: 'Biología', description: 'Biodiversidad y genética', icon: '🧬', parent: 'ciencia' },
  'ciencia/biotecnologia': { title: 'Biotecnología', description: 'Ingeniería biológica', icon: '🧬', parent: 'ciencia' },
  'ciencia/fisica': { title: 'Física', description: 'Leyes del universo y energía', icon: '⚛️', parent: 'ciencia' },
  'ciencia/descubrimientos': { title: 'Descubrimientos', description: 'Hitos científicos', icon: '💡', parent: 'ciencia' },
  'ciencia/astronomia': { title: 'Astronomía', description: 'Observación y cosmos', icon: '🔭', parent: 'ciencia' },

  medioambiente: { title: 'Medio Ambiente', description: 'Cambio climático, ecología, biodiversidad y sostenibilidad', icon: '🌲' },
  'medioambiente/clima': { title: 'Clima', description: 'Cambio climático y calentamiento', icon: '☀️', parent: 'medioambiente' },
  'medioambiente/sostenibilidad': { title: 'Sostenibilidad', description: 'Economía sostenible y reciclaje', icon: '♻️', parent: 'medioambiente' },
  'medioambiente/ecologia': { title: 'Ecología', description: 'Protección de ecosistemas', icon: '🌱', parent: 'medioambiente' },
  'medioambiente/energias renovables': { title: 'Energías Renovables', description: 'Solar, eólica y alternativas', icon: '☀️', parent: 'medioambiente' },
  'medioambiente/biodiversidad': { title: 'Biodiversidad', description: 'Fauna y flora global', icon: '🐾', parent: 'medioambiente' },
  'medioambiente/economia circular': { title: 'Economía Circular', description: 'Reducción y reutilización', icon: '🔄', parent: 'medioambiente' },

  cultura: { title: 'Cultura', description: 'Cine, literatura, series, música y periodismo cultural', icon: '🎬' },
  'cultura/cine': { title: 'Cine', description: 'Estrenos e industria del cine', icon: '🎬', parent: 'cultura' },
  'cultura/musica': { title: 'Música', description: 'Actualidad musical y conciertos', icon: '🎵', parent: 'cultura' },
  'cultura/literatura': { title: 'Literatura', description: 'Novedades editoriales y letras', icon: '📚', parent: 'cultura' },
  'cultura/arte': { title: 'Arte', description: 'Exposiciones y museos', icon: '🎨', parent: 'cultura' },
  'cultura/teatro': { title: 'Teatro', description: 'Escenarios y artes escénicas', icon: '🎭', parent: 'cultura' },
  'cultura/series': { title: 'Series / TV', description: 'Streaming y televisión', icon: '📺', parent: 'cultura' },

  deportes: { title: 'Deportes', description: 'Fútbol, ciclismo, motor, fórmula 1 y disciplinas olímpicas', icon: '⚽' },
  'deportes/futbol': { title: 'Fútbol', description: 'Actualidad futbolística', icon: '⚽', parent: 'deportes' },
  'deportes/futbol/laliga': { title: 'LaLiga EA Sports', description: 'Primera división española', icon: '🏆', parent: 'deportes/futbol' },
  'deportes/futbol/femenino': { title: 'Fútbol Femenino', description: 'Fútbol femenino profesional', icon: '👩', parent: 'deportes/futbol' },
  'deportes/futbol/champions': { title: 'Champions League', description: 'Fútbol de élite europeo', icon: '🇪🇺', parent: 'deportes/futbol' },
  'deportes/futbol/2': { title: '2ª División', description: 'Segunda división y ascenso', icon: '🥈', parent: 'deportes/futbol' },
  'deportes/futbol/general': { title: 'Fútbol General', description: 'Otras noticias de fútbol', icon: '⚽', parent: 'deportes/futbol' },
  'deportes/ciclismo/tour-de-francia': { title: 'Tour de Francia', description: 'Tour de Francia y ciclismo de élite', icon: '🚴🇫🇷', parent: 'deportes' },
  'deportes/ciclismo': { title: 'Ciclismo', description: 'Carreras y ciclismo de ruta', icon: '🚴', parent: 'deportes' },
  'deportes/motor': { title: 'Motor', description: 'Fórmula 1, MotoGP y rally', icon: '🏎️', parent: 'deportes' },
  'deportes/motor/f1': { title: 'Fórmula 1', description: 'Gran circo de la F1', icon: '🏎️', parent: 'deportes/motor' },
  'deportes/motor/motogp': { title: 'MotoGP', description: 'Mundial de motociclismo', icon: '🏍️', parent: 'deportes/motor' },
  'deportes/motor/general': { title: 'Motor General', description: 'Otras noticias del motor', icon: '🏎️', parent: 'deportes/motor' },
  'deportes/baloncesto': { title: 'Baloncesto', description: 'Liga Endesa, NBA y selecciones', icon: '🏀', parent: 'deportes' },
  'deportes/tenis': { title: 'Tenis', description: 'Grand Slams y circuitos ATP/WTA', icon: '🎾', parent: 'deportes' },
  'deportes/polideportivo': { title: 'Polideportivo', description: 'Otras disciplinas deportivas', icon: '🏆', parent: 'deportes' },

  estilo: { title: 'Estilo de Vida', description: 'Salud, bienestar, viajes y tendencias', icon: '🌱' },
  'estilo/bienestar': { title: 'Bienestar', description: 'Estilo de vida saludable y fitness', icon: '🧘', parent: 'estilo' },
  'estilo/viajes': { title: 'Viajes', description: 'Destinos y turismo', icon: '✈️', parent: 'estilo' },
  'estilo/tendencias': { title: 'Tendencias', description: 'Últimas novedades sociales', icon: '✨', parent: 'estilo' },
  'estilo/moda': { title: 'Moda', description: 'Diseño y pasarelas', icon: '👗', parent: 'estilo' },
  'estilo/hogar': { title: 'Hogar', description: 'Decoración y vida doméstica', icon: '🏠', parent: 'estilo' },

  sociedad: { title: 'Sociedad', description: 'Educación, sanidad, igualdad, debates éticos y derechos', icon: '👥' },
  'sociedad/educacion': { title: 'Educación', description: 'Colegios y universidades', icon: '🏫', parent: 'sociedad' },
  'sociedad/sanidad': { title: 'Sanidad', description: 'Salud pública y hospitales', icon: '🏥', parent: 'sociedad' },
  'sociedad/derechos humanos': { title: 'Derechos Humanos', description: 'Derechos fundamentales y debates', icon: '⚖️', parent: 'sociedad' },
  'sociedad/igualdad': { title: 'Igualdad', description: 'Políticas sociales y equidad', icon: '🤝', parent: 'sociedad' },
  'sociedad/redes sociales': { title: 'Redes Sociales', description: 'Impacto de las plataformas', icon: '📱', parent: 'sociedad' },
  'sociedad/meteorologia': { title: 'Meteorología', description: 'Tiempo y previsiones locales', icon: '⛈️', parent: 'sociedad' },

  gastronomia: { title: 'Gastronomía', description: 'Gastronomía, recetas, cultura culinaria y alimentación', icon: '🍳' },
  'gastronomia/recetas': { title: 'Recetas', description: 'Cocina paso a paso', icon: '🍳', parent: 'gastronomia' },
  'gastronomia/restaurantes': { title: 'Restaurantes', description: 'Críticas y recomendaciones', icon: '🍽️', parent: 'gastronomia' },
  'gastronomia/nutricion': { title: 'Nutrición', description: 'Consejos alimenticios', icon: '🥗', parent: 'gastronomia' },
  'gastronomia/vinos': { title: 'Vinos', description: 'Enología y bodegas', icon: '🍷', parent: 'gastronomia' },
  'gastronomia/cocina': { title: 'Cocina', description: 'Técnicas culinarias', icon: '🍳', parent: 'gastronomia' },
  'gastronomia/alimentacion': { title: 'Alimentación', description: 'Actualidad alimentaria', icon: '🍎', parent: 'gastronomia' }
};

export type CategoryKey = keyof typeof FEED_MATRIX;

export function getCategoryMeta(key: string) {
  return CATEGORY_META[key] || { title: key.split('/').pop() || key, description: '', icon: '📰' };
}

export function getFeedsForCategory(category: CategoryKey): FeedConfig[] {
  return FEED_MATRIX[category] || [];
}

export function getSubcategories(parent: string): string[] {
  return Object.entries(CATEGORY_META)
    .filter(([, meta]) => meta.parent === parent)
    .map(([key]) => key);
}

export function getAllCategories(): CategoryKey[] {
  return Object.keys(FEED_MATRIX) as CategoryKey[];
}
