import React, { useState, useEffect, useMemo, useRef } from 'react';

// Constantes y Configuraciones
const THEME_NAMES = {
  all: 'Todos',
  breaking: 'Última Hora',
  actualidad: 'Actualidad',
  'tecnologia-ciencia': 'Tecnología & Ciencia',
  'economia-negocios': 'Economía & Negocios',
  'estilo-vida': 'Estilo de Vida',
  deportes: 'Deportes',
  internacional: 'Internacional',
  nacional: 'Nacional',
  economia: 'Economía',
  opinion: 'Opinión',
  tecnologia: 'Tecnología',
  ciencia: 'Ciencia',
  medioambiente: 'Medio Ambiente',
  cultura: 'Cultura',
  estilo: 'Estilo',
  sociedad: 'Sociedad',
  gastronomia: 'Gastronomía',
  'bienestar-salud': 'Salud & Bienestar',
  mercados: 'Mercados',
  finanzas: 'Finanzas',
  macroeconomia: 'Macroeconomía',
  empresas: 'Empresas',
  empleo: 'Empleo',
  recursos: 'Energía & Recursos',
  futbol: 'Fútbol',
  motor: 'Motor',
  ciclismo: 'Ciclismo',
  baloncesto: 'Baloncesto',
  tenis: 'Tenis',
  polideportivo: 'Polideportivo'
};

const CATEGORY_DESCRIPTIONS = {
  internacional: 'Reportes de geopolítica mundial, eventos globales y diplomacia internacional.',
  nacional: 'Novedades sobre política, sociedad y justicia en el panorama nacional.',
  economia: 'Indicadores económicos, finanzas, balances empresariales y el pulso del mercado.',
  opinion: 'Análisis independientes, columnas y debates sobre los temas clave de actualidad.',
  tecnologia: 'Avances en informática, desarrollo de software, chips y la revolución de la IA.',
  ciencia: 'El cosmos, investigaciones de salud, física cuántica y hallazgos históricos.',
  medioambiente: 'Cambio climático, transición energética, biodiversidad y sostenibilidad.',
  cultura: 'Estrenos de cine, literatura, conciertos y las últimas manifestaciones artísticas.',
  deportes: 'Crónicas de fútbol, motor, tenis, ciclismo y polideportivo de todo el mundo.',
  estilo: 'Moda, alta relojería, viajes exclusivos y tendencias de diseño.',
  sociedad: 'Educación, derechos, demografía y corrientes de la sociedad digital.',
  gastronomia: 'Restaurantes, alta cocina, recetas y novedades vitivinícolas.'
};

const CATEGORY_FALLBACK_IMAGES = {
  internacional: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80'
  ],
  nacional: [
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509840144524-87119435ff3b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80'
  ],
  economia: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80'
  ],
  opinion: [
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=800&auto=format&fit=crop&q=80'
  ],
  tecnologia: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop&q=80'
  ],
  ciencia: [
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80'
  ],
  medioambiente: [
    'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&auto=format&fit=crop&q=80'
  ],
  cultura: [
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80'
  ],
  deportes: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=800&auto=format&fit=crop&q=80'
  ],
  estilo: [
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&auto=format&fit=crop&q=80'
  ],
  sociedad: [
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1468421870903-4df1664ac249?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80'
  ],
  gastronomia: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80'
  ],
  general: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504711698883-9651d48c31fe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop&q=80'
  ]
};

const PORTAL_MAPPING = {
  actualidad: ['internacional', 'nacional', 'opinion', 'sociedad'],
  'tecnologia-ciencia': ['tecnologia', 'ciencia', 'medioambiente'],
  'economia-negocios': ['economia'],
  'estilo-vida': ['estilo', 'bienestar-salud', 'gastronomia', 'cultura'],
  deportes: ['deportes']
};

const PORTAL_NAMES = {
  actualidad: 'Actualidad',
  'tecnologia-ciencia': 'Tecnología & Ciencia',
  'economia-negocios': 'Economía & Negocios',
  'estilo-vida': 'Estilo de Vida',
  deportes: 'Deportes'
};

const CATEGORY_TREE = {
  breaking: { name: 'Última Hora' },
  internacional: {
    name: 'Internacional',
    children: {
      europa: {
        name: 'Europa',
        children: {
          ue: { name: 'Unión Europea' },
          general: { name: 'General' }
        }
      },
      america: {
        name: 'América',
        children: {
          eeuu: { name: 'EE.UU.' },
          latam: { name: 'Latinoamérica' },
          general: { name: 'General' }
        }
      },
      asia: { name: 'Asia' },
      conflictos: { name: 'Conflictos' },
      'politica exterior': { name: 'Política Exterior' }
    }
  },
  nacional: {
    name: 'Nacional',
    children: {
      politica: { name: 'Política' },
      sociedad: { name: 'Sociedad' },
      justicia: { name: 'Justicia' },
      'economia nacional': { name: 'Economía Nacional' },
      comunidades: { name: 'Comunidades' },
      corrupcion: { name: 'Corrupción' }
    }
  },
  economia: {
    name: 'Economía',
    children: {
      mercados: { name: 'Mercados' },
      finanzas: { name: 'Finanzas' },
      macroeconomia: { name: 'Macroeconomía' },
      empresas: { name: 'Empresas' },
      empleo: { name: 'Empleo' },
      recursos: { name: 'Energía & Recursos' }
    }
  },
  opinion: {
    name: 'Opinión',
    children: {
      editorial: { name: 'Editorial' },
      columnas: { name: 'Columnas' },
      analisis: { name: 'Análisis' },
      debates: { name: 'Debates' }
    }
  },
  tecnologia: {
    name: 'Tecnología',
    children: {
      ia: {
        name: 'Inteligencia Artificial',
        children: {
          openai: { name: 'OpenAI' },
          google: { name: 'Google' },
          llms: { name: 'Modelos de Lenguaje' },
          general: { name: 'General' }
        }
      },
      ciberseguridad: { name: 'Ciberseguridad' },
      software: { name: 'Software & Dev' },
      hardware: { name: 'Hardware & Chips' },
      web3: { name: 'Web3 & Cripto' },
      moviles: { name: 'Móviles & Gadgets' }
    }
  },
  ciencia: {
    name: 'Ciencia',
    children: {
      espacio: { name: 'Cosmos & Espacio' },
      salud: { name: 'Medicina & Salud' },
      fisica: { name: 'Física & Cuántica' },
      biologia: { name: 'Biología & Evolución' },
      arqueologia: { name: 'Arqueología & Historia' }
    }
  },
  medioambiente: {
    name: 'Medio Ambiente',
    children: {
      'cambio climatico': { name: 'Cambio Climático' },
      sostenibilidad: { name: 'Sostenibilidad' },
      biodiversidad: { name: 'Biodiversidad' },
      desacres: { name: 'Eventos Extremos' }
    }
  },
  cultura: {
    name: 'Cultura',
    children: {
      cine: { name: 'Cine & Series' },
      literatura: { name: 'Libros & Autores' },
      arte: { name: 'Arte & Museos' },
      musica: { name: 'Música & Conciertos' }
    }
  },
  deportes: {
    name: 'Deportes',
    children: {
      futbol: { name: 'Fútbol' },
      baloncesto: { name: 'Baloncesto' },
      tenis: { name: 'Tenis' },
      ciclismo: { name: 'Ciclismo' },
      motor: { name: 'Fórmula 1 & MotoGP' },
      polideportivo: { name: 'Polideportivo' }
    }
  },
  estilo: {
    name: 'Estilo',
    children: {
      moda: { name: 'Moda & Tendencias' },
      viajes: { name: 'Viajes & Destinos' },
      arquitectura: { name: 'Arquitectura & Diseño' },
      relojes: { name: 'Alta Relojería' }
    }
  },
  sociedad: {
    name: 'Sociedad',
    children: {
      educacion: { name: 'Educación' },
      demografia: { name: 'Demografía' },
      derechos: { name: 'Derechos & Leyes' },
      redes: { name: 'Tendencias Digitales' }
    }
  },
  gastronomia: {
    name: 'Gastronomía',
    children: {
      restaurantes: { name: 'Restaurantes' },
      recetas: { name: 'Recetas & Cocina' },
      vinos: { name: 'Vinos & Bodegas' }
    }
  }
};

function renderString(val) {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    return val.aiSummary || val['Resumen en español'] || val.summary || val.title || '';
  }
  return '';
}

function getArticleImageUrl(art) {
  const defaultImg = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80';
  if (!art) return defaultImg;
  
  if (typeof art.imageUrl === 'string' && 
      art.imageUrl.startsWith('http') && 
      !art.imageUrl.startsWith('http://localhost') && 
      !art.imageUrl.includes('placeholder')) {
    return art.imageUrl;
  }
  
  const categoryKey = String(art.category || 'general').toLowerCase().trim();
  const pool = CATEGORY_FALLBACK_IMAGES[categoryKey] || CATEGORY_FALLBACK_IMAGES.general;
  
  if (!Array.isArray(pool) || pool.length === 0) {
    return defaultImg;
  }
  
  const seed = String(art.id || art.url || 'default');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index] || defaultImg;
}

function normalizeText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

let isServerSide = true;

function formatRelativeDate(dateInput) {
  if (isServerSide) {
    return ''; // Evita discrepancias de hidratación devolviendo vacío durante el SSR
  }
  if (!dateInput) return '';
  let date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  
  const now = Date.now();
  if (date.getTime() > now) {
    date = new Date(now);
  }
  
  const diffMs = now - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  
  if (diffMin < 60) {
    return `Hace ${diffMin <= 0 ? 1 : diffMin} min`;
  }
  if (diffHours < 48) {
    return `Hace ${diffHours} h`;
  }
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getNormalizedSubcatPath(category, subcategory) {
  if (!category || !subcategory) return '';
  const catKey = category.toLowerCase().trim();
  const subKey = subcategory.toLowerCase().trim();
  
  const parentNode = CATEGORY_TREE[catKey];
  if (!parentNode || !parentNode.children) return subKey;
  
  const directChild = parentNode.children[subKey];
  if (directChild) return subKey;
  
  for (const childKey in parentNode.children) {
    const childNode = parentNode.children[childKey];
    if (childNode.children && childNode.children[subKey]) {
      return `${childKey}/${subKey}`;
    }
  }
  return subKey;
}

function calculateJaccardSimilarityForTitles(str1, str2) {
  const getTokens = (s) => {
    return new Set(normalizeText(s).split(/\s+/).filter(t => t.length > 2));
  };
  const set1 = getTokens(str1);
  const set2 = getTokens(str2);
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

const getSlug = (title) => {
  if (!title) return '';
  let slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]+/g, '-') // Cambiar no alfanuméricos por guiones
    .replace(/(^-|-$)+/g, ''); // Limpiar guiones iniciales y finales
  
  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-+$/, '');
  }
  return slug;
};

export default function Portal({ recentArticles = [], totalArticlesCount: initialCount = 0, initialSelectedArticleId = null, initialCategory = null, initialTag = null, basePath: propBasePath = null }) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    isServerSide = false;
    setIsMounted(true);
  }, []);

  const [activeCategory, setActiveCategory] = useState(initialCategory || 'breaking');
  const [activeSubcategory, setActiveSubcategory] = useState(null);
  const [activeHashtag, setActiveHashtag] = useState(initialTag || null);
  const [activeSource, setActiveSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [activeSort, setActiveSort] = useState('recent');
  const [trendingTimeRange, setTrendingTimeRange] = useState('today');

  const [allArticles, setAllArticles] = useState(recentArticles);
  const [allArticlesLoaded, setAllArticlesLoaded] = useState(false);
  const [totalArticlesCount, setTotalArticlesCount] = useState(initialCount || recentArticles.length);

  // Detalle de Artículo y Lectura Infinita
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [infiniteArticles, setInfiniteArticles] = useState([]);
  const [infiniteArticlesQueue, setInfiniteArticlesQueue] = useState([]);
  const [infiniteNextIndex, setInfiniteNextIndex] = useState(0);
  const [isLoadingNextArticle, setIsLoadingNextArticle] = useState(false);

  // Menús y Modales
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [theme, setThemeState] = useState('dark');

  // Lightbox
  const [lightbox, setLightbox] = useState({
    isOpen: false,
    url: '',
    caption: '',
    gallery: [],
    index: 0
  });

  const searchInputRef = useRef(null);
  const infiniteObserverRef = useRef(null);

  const getBasePath = () => {
    if (propBasePath) return propBasePath;
    if (typeof window === 'undefined') return '/pro/aidaily/';
    const path = window.location.pathname;
    const idx = path.toLowerCase().indexOf('/aidaily/');
    if (idx !== -1) {
      return path.substring(0, idx + 9);
    }
    return '/pro/aidaily/';
  };

  const syncStateFromURL = () => {
    if (typeof window === 'undefined') return;
    
    const path = window.location.pathname.toLowerCase().replace(/index\.html$/, '').replace(/\.html$/, '');
    const basePath = getBasePath().toLowerCase();
    
    let relativePath = path;
    if (path.startsWith(basePath)) {
      relativePath = path.substring(basePath.length);
    }
    relativePath = relativePath.replace(/^\/+|\/+$/g, '');
    
    if (relativePath.includes('noticias/')) {
      const parts = relativePath.split('/');
      const slugOrId = parts[parts.length - 1] || parts[parts.length - 2];
      if (slugOrId && slugOrId !== 'noticias') {
        const found = allArticles.find(a => a.id === slugOrId || getSlug(a.title) === slugOrId);
        if (found) {
          openArticle(found.id);
        } else {
          openArticle(slugOrId);
        }
        return;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const sub = params.get('sub');
    const tag = params.get('tag');
    const source = params.get('source');
    const q = params.get('q');
    const p = parseInt(params.get('p')) || 1;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(relativePath)) {
      setActiveCategory('date');
    } else {
      const cat = relativePath.split('/')[0] || 'breaking';
      setActiveCategory(cat);
    }

    setActiveSubcategory(sub);
    setActiveHashtag(tag);
    setActiveSource(source);
    setSearchQuery(q || '');
    setCurrentPage(p);
  };

  const updateURL = (cat, sub, tag, src, query, page, openArtId = null) => {
    if (typeof window === 'undefined') return;
    const basePath = getBasePath();
    
    if (openArtId) {
      const openArt = allArticles.find(a => a.id === openArtId);
      const artSlug = openArt ? (getSlug(openArt.title) || openArtId) : openArtId;
      const finalURL = `${basePath}noticias/${artSlug}/`;
      if (window.location.pathname !== finalURL) {
        window.history.pushState(null, '', finalURL);
      }
      return;
    }

    let targetPath = basePath;
    if (cat === 'date') {
      const pathParts = window.location.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
      targetPath = `${basePath}${lastPart}/`;
    } else {
      targetPath = cat === 'breaking' ? basePath : `${basePath}${cat}/`;
    }

    const params = new URLSearchParams();
    if (sub) params.set('sub', sub);
    if (tag) params.set('tag', tag);
    if (src) params.set('source', src);
    if (query) params.set('q', query);
    if (page > 1) params.set('p', page);

    const searchStr = params.toString();
    const finalURL = targetPath + (searchStr ? '?' + searchStr : '');

    if (window.location.pathname + window.location.search !== finalURL) {
      window.history.pushState(null, '', finalURL);
    }
  };

  useEffect(() => {
    syncStateFromURL();
    
    const fetchAllArticles = async () => {
      try {
        const basePath = getBasePath();
        const res = await fetch(`${basePath}api/articles-light.json`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAllArticles(data);
            setTotalArticlesCount(data.length);
            setAllArticlesLoaded(true);

            if (initialSelectedArticleId) {
              const art = data.find(a => a.id === initialSelectedArticleId);
              if (art) {
                openArticle(initialSelectedArticleId, data);
              }
            }
          }
        }
      } catch (e) {
        console.error("[Portal] Falló fetch de histórico:", e);
      }
    };

    fetchAllArticles();

    const handlePopState = () => {
      syncStateFromURL();
    };
    window.addEventListener('popstate', handlePopState);

    const interval = setInterval(() => {
      const clockEl = document.getElementById('top-bar-date');
      if (clockEl) {
        const now = new Date();
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          const monthsCompact = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
          clockEl.innerText = `${now.getDate()} ${monthsCompact[now.getMonth()]} • ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          clockEl.innerText = now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
      }
    }, 1000);

    const savedTheme = localStorage.getItem('aidaily_theme') || 'dark';
    setTheme(savedTheme);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [initialSelectedArticleId]);

  const setTheme = (themeName) => {
    setThemeState(themeName);
    localStorage.setItem('aidaily_theme', themeName);
    document.documentElement.className = '';
    if (themeName !== 'dark') {
      document.documentElement.classList.add(`theme-${themeName}`);
    }
  };

  const filteredArticles = useMemo(() => {
    return allArticles.filter(art => {
      const hasEnglishWords = /\b(the|and|of|with|from|this|that|about|would|their|there|which)\b/i;
      if (hasEnglishWords.test(art.title)) return false;

      if (searchQuery) {
        const q = normalizeText(searchQuery);
        const inTitle = normalizeText(art.title).includes(q);
        const inSummary = normalizeText(art.aiSummary || art.summary).includes(q);
        const inHashtags = Array.isArray(art.hashtags) && art.hashtags.some(h => normalizeText(h).includes(q));
        if (!inTitle && !inSummary && !inHashtags) return false;
      }

      if (activeHashtag) {
        const tagNorm = normalizeText(activeHashtag).replace('#', '');
        const artTags = Array.isArray(art.hashtags) ? art.hashtags.map(h => normalizeText(h).replace('#', '')) : [];
        if (!artTags.includes(tagNorm)) return false;
      }

      if (activeSource) {
        if (normalizeText(art.source) !== normalizeText(activeSource)) return false;
      }

      if (activeCategory && activeCategory !== 'breaking' && activeCategory !== 'date') {
        const portalSubcats = PORTAL_MAPPING[activeCategory];
        const artCat = normalizeText(art.category);
        
        if (portalSubcats) {
          if (!portalSubcats.includes(artCat)) return false;
        } else {
          if (artCat !== normalizeText(activeCategory)) return false;
        }
      }

      if (activeSubcategory) {
        const artSub = normalizeText(art.subcategory);
        if (artSub !== normalizeText(activeSubcategory)) return false;
      }

      return true;
    });
  }, [allArticles, activeCategory, activeSubcategory, activeHashtag, activeSource, searchQuery]);

  const sortedArticles = useMemo(() => {
    let result = [...filteredArticles];
    if (activeSort === 'trending') {
      result.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    } else {
      result.sort((a, b) => new Date(b.publishedAt || b.published) - new Date(a.publishedAt || a.published));
    }
    return result;
  }, [filteredArticles, activeSort]);

  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedArticles.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedArticles, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedArticles.length / itemsPerPage);

  const handleSelectCategory = (cat) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
    setActiveHashtag(null);
    setActiveSource(null);
    setSearchQuery('');
    setCurrentPage(1);
    setIsMenuOpen(false);
    setSelectedArticle(null);
    updateURL(cat, null, null, null, '', 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSubcategory = (sub, parentCat) => {
    setActiveCategory(parentCat);
    setActiveSubcategory(sub);
    setActiveHashtag(null);
    setActiveSource(null);
    setSearchQuery('');
    setCurrentPage(1);
    setSelectedArticle(null);
    updateURL(parentCat, sub, null, null, '', 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = async (artId, customArticles = null) => {
    const articlesPool = customArticles || allArticles;
    const art = articlesPool.find(a => a.id === artId);
    if (!art) return;

    setSelectedArticle(art);
    setInfiniteArticles([art]);
    
    updateURL(null, null, null, null, null, null, art.id);

    if (!art.fullArticle) {
      try {
        const cleanId = artId.replace(/[^a-zA-Z0-9]/g, '_');
        const res = await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/articles/${cleanId}.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.fullArticle) {
            const updated = { ...art, ...data };
            setSelectedArticle(updated);
            setInfiniteArticles([updated]);
          }
        }
      } catch (e) {
        console.warn("[Portal] Falló fetch de Firebase:", e);
      }
    }

    const queue = articlesPool
      .filter(a => a.id !== art.id && normalizeText(a.category) === normalizeText(art.category))
      .map(a => {
        let score = 0;
        if (normalizeText(a.subcategory) === normalizeText(art.subcategory)) score += 10;
        if (Array.isArray(a.hashtags) && Array.isArray(art.hashtags)) {
          const common = a.hashtags.filter(h => art.hashtags.includes(h));
          score += common.length * 8;
        }
        score += calculateJaccardSimilarityForTitles(art.title, a.title) * 20;
        return { article: a, score };
      })
      .sort((a, b) => b.score - a.score || new Date(b.article.publishedAt) - new Date(a.article.publishedAt))
      .map(s => s.article);

    setInfiniteArticlesQueue(queue);
    setInfiniteNextIndex(0);
  };

  const closeArticleView = () => {
    setSelectedArticle(null);
    setInfiniteArticles([]);
    setInfiniteArticlesQueue([]);
    document.title = 'AIDAILY — El futuro contado hoy';
    
    updateURL(activeCategory, activeSubcategory, activeHashtag, activeSource, searchQuery, currentPage);
  };

  const loadNextArticle = async () => {
    if (isLoadingNextArticle || infiniteNextIndex >= infiniteArticlesQueue.length) return;
    setIsLoadingNextArticle(true);

    const nextArt = infiniteArticlesQueue[infiniteNextIndex];
    setInfiniteNextIndex(prev => prev + 1);

    if (!nextArt.fullArticle) {
      try {
        const cleanId = nextArt.id.replace(/[^a-zA-Z0-9]/g, '_');
        const res = await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/articles/${cleanId}.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.fullArticle) {
            Object.assign(nextArt, data);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    setInfiniteArticles(prev => [...prev, nextArt]);
    setIsLoadingNextArticle(false);
  };

  // IntersectionObserver para cambiar URL y título en lectura infinita
  useEffect(() => {
    if (!selectedArticle || infiniteArticles.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const title = entry.target.getAttribute('data-title');
          const id = entry.target.getAttribute('data-id');
          document.title = `${title} — AIDAILY`;
          
          const breadcrumbTitle = document.getElementById('breadcrumb-article-title');
          if (breadcrumbTitle) breadcrumbTitle.innerText = title;

          if (id) {
            const basePath = getBasePath();
            const openArt = allArticles.find(a => a.id === id);
            const artSlug = openArt ? (getSlug(openArt.title) || id) : id;
            const newPath = `${basePath}noticias/${artSlug}/`;
            if (window.location.pathname !== newPath) {
              window.history.replaceState(null, '', newPath);
            }
          }
        }
      });
    }, { rootMargin: "-25% 0px -55% 0px" });

    document.querySelectorAll('.article-item-wrapper').forEach(el => observer.observe(el));
    infiniteObserverRef.current = observer;

    return () => {
      if (infiniteObserverRef.current) infiniteObserverRef.current.disconnect();
    };
  }, [infiniteArticles, selectedArticle]);

  const openLightbox = (url, caption) => {
    setLightbox({
      isOpen: true,
      url,
      caption,
      gallery: [url],
      index: 0
    });
  };

  const closeLightbox = () => {
    setLightbox(prev => ({ ...prev, isOpen: false }));
  };

  // Sidebar Lo Más Leído (Trending)
  const sidebarTrending = useMemo(() => {
    return [...allArticles]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 5);
  }, [allArticles]);

  // Artículos del Carrusel Superior Quick Reels (Historias de Tendencias)
  const quickReelsArticles = useMemo(() => {
    return sortedArticles.slice(1, 9);
  }, [sortedArticles]);

  // Lógica de Renderizado del Cuerpo del Artículo con Placeholders Multimedia
  const renderArticleBody = (art) => {
    if (!art) return null;
    const text = renderString(art.fullArticle || art.aiSummary || art.summary);
    if (!text) return null;
    
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    return paragraphs.map((p, idx) => {
      const trimmed = p.trim();
      const match = trimmed.match(/\[MULTIMEDIA:\s*(https?:\/\/[^\]\s]+)\]/i);
      
      if (match) {
        const mediaUrl = match[1].trim();
        const mediaItem = Array.isArray(art.multimedia) ? art.multimedia.find(m => m.url === mediaUrl) : null;
        
        if (mediaItem) {
          const captionHtml = mediaItem.caption ? (
            <div className="inline-image-caption" style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {mediaItem.caption}
            </div>
          ) : null;
          
          if (mediaItem.type === 'youtube' || mediaItem.url.includes('youtube.com/embed/') || mediaItem.url.includes('youtube.com/watch') || mediaItem.url.includes('youtu.be')) {
            let embedUrl = mediaItem.url;
            if (embedUrl.includes('watch?v=')) {
              embedUrl = embedUrl.replace('watch?v=', 'embed/');
            } else if (embedUrl.includes('youtu.be/')) {
              embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
            }
            return (
              <div key={idx} className="inline-article-video-container" style={{ margin: '24px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', aspectRatio: '16/9', background: '#000' }}>
                <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen loading="lazy"></iframe>
                {captionHtml}
              </div>
            );
          } else if (mediaItem.type === 'twitter' || mediaItem.url.includes('twitter.com') || mediaItem.url.includes('x.com')) {
            return (
              <div key={idx} className="inline-article-tweet-container" style={{ margin: '24px auto', maxWidth: '550px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <blockquote className="twitter-tweet" data-theme="dark" data-align="center">
                  <a href={mediaItem.url}></a>
                </blockquote>
                {captionHtml}
              </div>
            );
          } else {
            return (
              <div key={idx} className="inline-article-image-container" style={{ margin: '24px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => openLightbox(mediaItem.url, mediaItem.caption)}>
                <img src={mediaItem.url} alt={mediaItem.alt || 'Imagen'} style={{ width: '100%', maxHeight: '450px', objectFit: 'cover' }} loading="lazy" />
                {captionHtml}
              </div>
            );
          }
        }
      }
      
      const cleanText = trimmed.replace(/\[MULTIMEDIA:\s*(https?:\/\/[^\]\s]+)\]/gi, '');
      if (cleanText.trim().length === 0) return null;
      
      return (
        <p key={idx} style={{ marginBottom: '16px' }}>
          {cleanText}
        </p>
      );
    });
  };

  const isSearchActive = !!(searchQuery || activeHashtag || activeSource || activeSubcategory || (activeCategory && activeCategory !== 'breaking'));

  // Comprobar si es un portal por mapeo o una categoría principal con subcategorías
  const isPortal = PORTAL_MAPPING[activeCategory];
  const catTree = CATEGORY_TREE[activeCategory];
  const catChildren = catTree ? Object.keys(catTree.children || {}) : [];
  const isCategoryWithSubs = !isPortal && catChildren.length > 0;

  const basePath = getBasePath();

  return (
    <>
      <div className="glow-bg glow-purple"></div>
      <div className="glow-bg glow-cyan"></div>

      {/* Marquesina y Reloj */}
      <div className="top-bar">
        <div className="top-bar-container">
          <div className="top-bar-date" id="top-bar-date">
            Cargando hora...
          </div>
          <div className="top-bar-ticker-wrap">
            <div className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
              <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }}></div>
              <iframe
                src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Header Sticky */}
      <div className="sticky-header-wrapper">
        <header>
          <div className="header-container">
            <span className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>☰</span>
            <div className="brand" onClick={() => handleSelectCategory('breaking')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.45rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, var(--accent-cyan) 50%, var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1 }}>AIDAILY</h1>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600, marginTop: 1, lineHeight: 1 }}>El futuro contado hoy</p>
              </div>
            </div>

            {/* Buscador */}
            <div className={`header-search-container ${isSearchBoxOpen ? 'active' : ''}`}>
              <button className="search-toggle-btn" onClick={() => setIsSearchBoxOpen(!isSearchBoxOpen)}>🔍</button>
              {isSearchBoxOpen && (
                <div className="header-search-box" style={{ display: 'flex' }}>
                  <div className="smart-search-wrapper">
                    <input
                      type="text"
                      ref={searchInputRef}
                      className="header-search-input"
                      placeholder="Buscar IA, OpenAI, deportes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setIsSearchBoxOpen(false);
                      }}
                      autoFocus
                    />
                  </div>
                  <button className="search-close-btn" onClick={() => { setSearchQuery(''); setIsSearchBoxOpen(false); }}>✕</button>
                </div>
              )}
            </div>

            {/* Selector de Temas */}
            <div className="theme-selector-wrapper">
              <button className="search-toggle-btn" onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}>◐</button>
              <div className={`theme-menu-dropdown ${isThemeMenuOpen ? 'active' : ''}`} style={{ opacity: isThemeMenuOpen ? 1 : 0, visibility: isThemeMenuOpen ? 'visible' : 'hidden' }}>
                <a className="dropdown-sub-link" onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}>Cyber Oscuro</a>
                <a className="dropdown-sub-link" onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}>Claro Premium</a>
                <a className="dropdown-sub-link" onClick={() => { setTheme('blue'); setIsThemeMenuOpen(false); }}>Azul Espacial</a>
              </div>
            </div>

            <a href="/pro/aidaily/admin.html" className="admin-config-link" title="Administración">⚙</a>
          </div>
        </header>

        {/* Categorías Principales */}
        <nav className="nyt-nav">
          <div className="nyt-nav-container">
            {Object.keys(PORTAL_NAMES).map(key => (
              <a
                key={key}
                className={`nyt-nav-link ${activeCategory === key ? 'active' : ''}`}
                onClick={() => handleSelectCategory(key)}
              >
                {PORTAL_NAMES[key].toUpperCase()}
              </a>
            ))}
          </div>
        </nav>

        {/* Subcategorías Dinámicas */}
        {activeCategory && CATEGORY_TREE[activeCategory]?.children && (
          <div className="nyt-subnav" style={{ display: 'block', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: 12, overflowX: 'auto', padding: '6px 24px' }}>
              {Object.entries(CATEGORY_TREE[activeCategory].children).map(([subKey, node]) => (
                <a
                  key={subKey}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: activeSubcategory === subKey ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => handleSelectSubcategory(subKey, activeCategory)}
                >
                  {node.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Overlay Drawer */}
      <div className={`menu-drawer-overlay ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
      <div className={`menu-drawer ${isMenuOpen ? 'active' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-brand">AIDAILY</span>
          <span className="drawer-close-btn" onClick={() => setIsMenuOpen(false)}>✕</span>
        </div>
        <nav className="drawer-menu-list">
          {Object.keys(PORTAL_NAMES).map(key => (
            <a key={key} onClick={() => handleSelectCategory(key)}>{PORTAL_NAMES[key]}</a>
          ))}
          <a href="/pro/aidaily/admin.html" style={{ color: '#f87171' }}>Administración</a>
        </nav>
      </div>

      {/* VISTA PRINCIPAL O DETALLE */}
      {!selectedArticle ? (
        <div className="feed-container" id="feed-layout-container">
          <div className="feed-main-column">
            
            {/* Carrusel superior Quick Reels (Stories) */}
            {currentPage === 1 && !isSearchActive && activeCategory === 'breaking' && quickReelsArticles.length > 0 && (
              <div className="quick-reels" style={{ display: 'flex', marginBottom: '24px' }}>
                {quickReelsArticles.map(art => (
                  <a
                    key={art.id}
                    href={`${basePath}noticias/${getSlug(art.title) || art.id}/`}
                    className="reel-item"
                    onClick={(e) => { e.preventDefault(); openArticle(art.id); }}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="reel-img-wrapper">
                      <img className="reel-img" src={getArticleImageUrl(art)} alt={art.title} loading="lazy" />
                    </div>
                    <div className="reel-content-wrapper">
                      <p className="reel-topic-title">{String(art.category || 'general').toUpperCase()}</p>
                      <h4 className="reel-title">{renderString(art.title)}</h4>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <h2 className="section-header">{THEME_NAMES[activeCategory] || 'Noticias'}</h2>

            {/* Barra de Filtros */}
            <div id="feed-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid var(--border-color)', paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveSort('recent')}
                  className={`filter-tab-btn ${activeSort === 'recent' ? 'active' : ''}`}
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: activeSort === 'recent' ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: activeSort === 'recent' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  📅 MÁS RECIENTES
                </button>
                <button
                  onClick={() => setActiveSort('trending')}
                  className={`filter-tab-btn ${activeSort === 'trending' ? 'active' : ''}`}
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: activeSort === 'trending' ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: activeSort === 'trending' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  🔥 LO MÁS LEÍDO
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL PORTAL (ESTILO PERIODICO NYT) */}
            {((isPortal || isCategoryWithSubs) && !activeSubcategory) && !isSearchActive && currentPage === 1 ? (
              <div className="portal-sections-container">
                {(isPortal ? PORTAL_MAPPING[activeCategory] : [activeCategory]).map(childCat => {
                  const childName = THEME_NAMES[childCat] || childCat;
                  const childDesc = CATEGORY_DESCRIPTIONS[childCat] || '';
                  const catArticles = allArticles.filter(art => normalizeText(art.category) === normalizeText(childCat));
                  const leadArt = catArticles[0];
                  const secondaryArticles = catArticles.slice(1, 3);

                  if (catArticles.length === 0) return null;

                  return (
                    <section key={childCat} className="portal-vertical-section" style={{ marginBottom: '36px' }}>
                      <div className="portal-section-header">
                        <div className="portal-section-title-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 className="portal-section-title">{childName}</h3>
                          <a className="portal-section-more" onClick={() => handleSelectCategory(childCat)} style={{ cursor: 'pointer' }}>
                            Ver todo en {childName} <span>→</span>
                          </a>
                        </div>
                        <p className="portal-section-description">{childDesc}</p>
                        {CATEGORY_TREE[childCat]?.children && (
                          <div className="portal-section-subnav" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            <span className="portal-section-subnav-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Apartados:</span>
                            {Object.entries(CATEGORY_TREE[childCat].children).slice(0, 8).map(([subKey, subNode]) => (
                              <a key={subKey} className="portal-section-subnav-link" onClick={() => handleSelectSubcategory(subKey, childCat)} style={{ fontSize: '0.65rem', cursor: 'pointer', color: 'var(--accent-cyan)', marginRight: '8px' }}>
                                {subNode.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {leadArt && (
                        <div className="portal-news-grid">
                          {/* Destacada Principal */}
                          <a href={`${basePath}noticias/${getSlug(leadArt.title) || leadArt.id}/`} className="portal-lead-column" onClick={(e) => { e.preventDefault(); openArticle(leadArt.id); }} style={{ textDecoration: 'none', display: 'block' }}>
                            <div className="portal-lead-img-wrapper">
                              <img className="portal-lead-img" src={getArticleImageUrl(leadArt)} alt={leadArt.title} loading="lazy" />
                            </div>
                            <span className="portal-lead-meta" style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase' }}>{leadArt.source}</span>
                            <h4 className="portal-lead-title">{renderString(leadArt.title)}</h4>
                            <p className="portal-lead-summary">{renderString(leadArt.aiSummary || leadArt.summary)}</p>
                            <div className="portal-lead-footer" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                              <span>RSS: {formatRelativeDate(leadArt.publishedAt)}</span>
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Reporte completo →</span>
                            </div>
                          </a>

                          {/* Secundarias de Columna Derecha */}
                          <div className="portal-side-column">
                            {secondaryArticles.map(secArt => (
                              <a key={secArt.id} href={`${basePath}noticias/${getSlug(secArt.title) || secArt.id}/`} className="portal-secondary-item" onClick={(e) => { e.preventDefault(); openArticle(secArt.id); }} style={{ textDecoration: 'none', display: 'block', marginBottom: '16px' }}>
                                <span className="portal-secondary-meta" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{secArt.source.toUpperCase()} • {formatRelativeDate(secArt.publishedAt)}</span>
                                <h4 className="portal-secondary-title" style={{ fontSize: '0.92rem', fontWeight: 700, margin: '4px 0' }}>{renderString(secArt.title)}</h4>
                                <p className="portal-secondary-summary" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0' }}>{renderString(secArt.aiSummary || secArt.summary)}</p>
                                <div className="portal-secondary-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.68rem' }}>Leer →</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              /* PORTADA DE PERIÓDICO ASIMÉTRICA DE 3 COLUMNAS (Para breaking/Inicio) */
              <div className="main-layout">
                <main id="news-feed" style={{ display: 'block', width: '100%' }}>
                  {sortedArticles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-color)', borderRadius: 16 }}>
                      <h3>Sin resultados</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No hay reportes que coincidan con los filtros actuales.</p>
                    </div>
                  ) : (
                    <>
                      {/* Portada de 3 Columnas en Página 1 */}
                      {currentPage === 1 && !isSearchActive && sortedArticles[0] && (
                        <div className="nyt-front-page-3col" style={{ marginBottom: '32px' }}>
                          {/* Columna Lead */}
                          <a href={`${basePath}noticias/${getSlug(sortedArticles[0].title) || sortedArticles[0].id}/`} className="nyt-lead-column" onClick={(e) => { e.preventDefault(); openArticle(sortedArticles[0].id); }} style={{ textDecoration: 'none', display: 'block' }}>
                            <div className="lead-story-image-wrapper">
                              <img className="lead-story-img" src={getArticleImageUrl(sortedArticles[0])} alt={sortedArticles[0].title} loading="lazy" />
                            </div>
                            <span className="card-source" style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 800, marginTop: '4px', display: 'block' }}>
                              {String(sortedArticles[0].category || 'general').toUpperCase()}
                            </span>
                            <h2 className="lead-story-title" style={{ fontSize: '1.45rem', fontWeight: 800, margin: '8px 0' }}>{renderString(sortedArticles[0].title)}</h2>
                            <p className="lead-story-summary">{renderString(sortedArticles[0].aiSummary || sortedArticles[0].summary)}</p>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                              <span>RSS: {formatRelativeDate(sortedArticles[0].publishedAt)}</span>
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Leer reporte completo →</span>
                            </div>
                          </a>

                          {/* Columna Middle */}
                          {sortedArticles[1] && (
                            <a href={`${basePath}noticias/${getSlug(sortedArticles[1].title) || sortedArticles[1].id}/`} className="nyt-middle-column" onClick={(e) => { e.preventDefault(); openArticle(sortedArticles[1].id); }} style={{ textDecoration: 'none', display: 'block' }}>
                              <div className="lead-story-image-wrapper" style={{ maxHeight: '180px' }}>
                                <img className="lead-story-img" src={getArticleImageUrl(sortedArticles[1])} alt={sortedArticles[1].title} loading="lazy" />
                              </div>
                              <span className="card-source" style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 800, marginTop: '4px', display: 'block' }}>
                                {String(sortedArticles[1].category || 'general').toUpperCase()}
                              </span>
                              <h3 className="side-story-title" style={{ fontSize: '1.15rem' }}>{renderString(sortedArticles[1].title)}</h3>
                              <p className="side-story-summary" style={{ fontSize: '0.78rem' }}>{renderString(sortedArticles[1].aiSummary || sortedArticles[1].summary)}</p>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                <span>RSS: {formatRelativeDate(sortedArticles[1].publishedAt)}</span>
                                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Leer →</span>
                              </div>
                            </a>
                          )}

                          {/* Columna Side Stories (Noticias 3, 4 y 5) */}
                          <div className="nyt-side-column">
                            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1.5px solid var(--text-title)', paddingBottom: '6px', color: 'var(--text-title)', marginBottom: '10px' }}>Otras Noticias</h3>
                            {sortedArticles.slice(2, 5).map(side => (
                              <a key={side.id} href={`${basePath}noticias/${getSlug(side.title) || side.id}/`} className="side-story-item" onClick={(e) => { e.preventDefault(); openArticle(side.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '4px', textDecoration: 'none', marginBottom: '16px' }}>
                                <span className="card-source" style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 800 }}>
                                  {String(side.category || 'general').toUpperCase()}
                                </span>
                                <h4 className="side-story-title" style={{ fontSize: '0.88rem', lineHeight: 1.25 }}>{renderString(side.title)}</h4>
                                <p className="side-story-summary" style={{ fontSize: '0.74rem', lineHeight: 1.35 }}>{renderString(side.aiSummary || side.summary)}</p>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatRelativeDate(side.publishedAt)}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feed Secundario de Noticias en Grid de Tarjetas Horizontales */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                        {sortedArticles.slice(currentPage === 1 && !isSearchActive ? 5 : 0).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(art => (
                          <a key={art.id} href={`${basePath}noticias/${getSlug(art.title) || art.id}/`} className="row-card-link" onClick={(e) => { e.preventDefault(); openArticle(art.id); }} style={{ textDecoration: 'none', display: 'block' }}>
                            <div className="row-card" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', padding: 16 }}>
                              <img src={getArticleImageUrl(art)} alt={art.title} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: 8 }} />
                              <div style={{ marginTop: 12 }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase' }}>{art.source}</span>
                                <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: '6px 0' }}>{renderString(art.title)}</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{renderString(art.aiSummary || art.summary)}</p>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </main>

                {/* BARRA LATERAL (LO MÁS LEÍDO) */}
                {!isSearchActive && (
                  <aside className="nyt-sidebar" style={{ display: 'block', minWidth: '300px' }}>
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.85rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 16 }}>LO MÁS LEÍDO</h3>
                    {sidebarTrending.map((art, idx) => (
                      <a key={art.id} href={`${basePath}noticias/${getSlug(art.title) || art.id}/`} onClick={(e) => { e.preventDefault(); openArticle(art.id); }} style={{ textDecoration: 'none', display: 'flex', gap: 12, marginBottom: 16, cursor: 'pointer' }}>
                        <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{idx + 1}</span>
                        <div>
                          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', margin: 0 }}>{renderString(art.title)}</h4>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{art.source}</span>
                        </div>
                      </a>
                    ))}
                  </aside>
                )}
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentPage(idx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={{
                      padding: '6px 12px',
                      background: currentPage === idx + 1 ? 'var(--accent-cyan)' : 'transparent',
                      border: '1px solid var(--border-color)',
                      color: currentPage === idx + 1 ? '#000' : '#fff',
                      cursor: 'pointer',
                      borderRadius: 6
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA DETALLE DE LECTURA INFINITA CON MATERIAL EMBEBIDO */
        <div className="article-detail-view" style={{ display: 'block' }}>
          <div className="article-detail-container">
            <div className="article-breadcrumb-bar scrolled">
              <div className="breadcrumb-left-group">
                <button className="article-back-btn" onClick={closeArticleView}>← Volver</button>
                <div id="breadcrumb-article-title" style={{ fontWeight: 800, color: '#fff', marginLeft: 12 }}>{renderString(selectedArticle.title)}</div>
              </div>
            </div>

            <div id="infinite-articles-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
              {infiniteArticles.map(art => (
                <article key={art.id} className="news-detail-wrapper article-item-wrapper" data-id={art.id} data-title={renderString(art.title)} style={{ marginBottom: 60, borderBottom: '1px solid var(--border-color)', paddingBottom: 40 }}>
                  <header style={{ marginBottom: 24 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase' }}>{art.source}</span>
                    <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', fontWeight: 800, color: '#fff', margin: '12px 0 16px 0' }}>{renderString(art.title)}</h1>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Publicado: {formatRelativeDate(art.publishedAt || art.published)}</div>
                  </header>

                  <img src={getArticleImageUrl(art)} alt={art.title} style={{ width: '100%', maxHeight: '460px', objectFit: 'cover', borderRadius: 16, marginBottom: 28 }} />

                  {Array.isArray(art.keyPoints) && art.keyPoints.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', padding: 20, borderRadius: 12, marginBottom: 24 }}>
                      <h3 style={{ color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px 0' }}>PUNTOS CLAVE</h3>
                      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-title)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        {art.keyPoints.map((kp, i) => <li key={i} style={{ marginBottom: 6 }}>{renderString(kp)}</li>)}
                      </ul>
                    </div>
                  )}

                  {art.whyMatters && (
                    <div style={{ borderLeft: '3px solid var(--accent-purple)', paddingLeft: 16, margin: '24px 0', fontStyle: 'italic', color: 'var(--text-title)', fontSize: '0.92rem' }}>
                      <strong>POR QUÉ IMPORTA: </strong>{renderString(art.whyMatters)}
                    </div>
                  )}

                  {/* Cuerpo de Artículo Intercalado con Embeds */}
                  <div className="article-body-content" style={{ fontSize: '1.02rem', lineHeight: 1.75, color: 'var(--text-title)' }}>
                    {renderArticleBody(art)}
                  </div>

                  {Array.isArray(art.links) && art.links.length > 0 && (
                    <div style={{ marginTop: 32 }}>
                      <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: 12 }}>ENLACES DE INTERÉS</h4>
                      {art.links.map((link, idx) => (
                        <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--text-title)', fontSize: '0.85rem', textDecoration: 'underline', marginBottom: 6 }}>
                          🔗 {link.title || link.url}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}

              {infiniteNextIndex < infiniteArticlesQueue.length && (
                <button
                  onClick={loadNextArticle}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 16,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-title)',
                    fontSize: '0.82rem',
                    fontWeight: 800
                  }}
                >
                  {isLoadingNextArticle ? 'Cargando recomendados...' : 'CARGAR SIGUIENTE ARTÍCULO'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.isOpen && (
        <div className="lightbox-overlay" style={{ display: 'flex' }} onClick={closeLightbox}>
          <span className="lightbox-close" onClick={closeLightbox}>✕</span>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            <img className="lightbox-img" src={lightbox.url} alt={lightbox.caption} />
            <div className="lightbox-caption">{lightbox.caption}</div>
          </div>
        </div>
      )}

      <button id="scroll-top-btn" className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>▲</button>
    </>
  );
}
