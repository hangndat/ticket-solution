import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { resolveRobotsPolicy } from '../src/marketing/seo/robots-sitemap';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const policy = resolveRobotsPolicy(host);
  return {
    rules: policy.rules,
    sitemap: policy.sitemap,
    host: policy.host,
  };
}
