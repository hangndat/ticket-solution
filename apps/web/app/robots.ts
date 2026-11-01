import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { trustedRequestHost } from '../src/marketing/hosts';
import { resolveRobotsPolicy } from '../src/marketing/seo/robots-sitemap';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = trustedRequestHost(h);
  const policy = resolveRobotsPolicy(host);
  return {
    rules: policy.rules,
    sitemap: policy.sitemap,
    host: policy.host,
  };
}
