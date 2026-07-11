#!/usr/bin/env node
// Fetch news - standalone Node script using built Astro config
import { fetchAllNews } from '../src/lib/sources.ts';

const items = await fetchAllNews();
console.log('ITEMS_COUNT:' + items.length);
const byDate = new Map();
for (const item of items) {
    const d = new Date(item.publishedAt).toISOString().split('T')[0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(item);
}
for (const [date, arr] of byDate) {
    console.log('DATE:' + date + ':' + arr.length);
}