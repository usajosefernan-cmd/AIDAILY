import rss from '@astrojs/rss';
import { fetchAllNews } from '../lib/sources';

export async function GET({ site }) {
  const items = await fetchAllNews();
  
  // Filtrar robustamente artículos inválidos para evitar errores de build en @astrojs/rss
  const validItems = items.filter(item => {
    if (!item) return false;
    const hasTitle = typeof item.title === 'string' && item.title.trim().length > 0;
    const hasDescription = typeof item.summary === 'string' && item.summary.trim().length > 0;
    const hasDate = item.publishedAt && !isNaN(new Date(item.publishedAt).getTime());
    return hasTitle && hasDescription && hasDate;
  });

  return rss({
    title: 'IA Daily',
    description: 'Noticias IA diarias de fuentes especializadas con imágenes y multimedia.',
    site: site || 'https://pecemi.web.app/aidaily',
    items: validItems.map(item => {
      let dateStr;
      try {
        dateStr = new Date(item.publishedAt).toISOString().split('T')[0];
      } catch (e) {
        dateStr = new Date().toISOString().split('T')[0];
      }
      
      return {
        title: item.title,
        description: item.summary,
        link: `/aidaily/${dateStr}/`,
        pubDate: new Date(item.publishedAt),
        categories: item.source ? [item.source] : [],
        customData: `<content:encoded><![CDATA[${item.summary}]]></content:encoded>`
      };
    }),
    customData: `<language>es</language><atom:link href="${site || 'https://pecemi.web.app/aidaily'}/rss.xml" rel="self" type="application/rss+xml" />`,
    stylesheet: '/aidaily/rss.xsl'
  });
}

