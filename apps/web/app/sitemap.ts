import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { trustedRequestHost } from '../src/marketing/hosts';
import { resolveSitemapEntries } from '../src/marketing/seo/robots-sitemap';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = trustedRequestHost(h);
  const entries = resolveSitemapEntries(host);
  return entries.map((e) => ({
    url: e.url,
    lastModified: e.lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
    alternates: e.alternates,
  }));
}
