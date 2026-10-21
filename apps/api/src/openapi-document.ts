import type { OpenAPIObject, PathsObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface.js';

/** Platform controllers split from legacy `PlatformController` — OpenAPI operationIds stay prefixed. */
export const PLATFORM_SPLIT_CONTROLLER_KEYS = new Set([
  'PlatformMeController',
  'PlatformOperatorController',
  'PlatformMembershipController',
]);

const LEGACY_PLATFORM_CONTROLLER = 'PlatformController';

export function platformAwareOperationIdFactory(
  controllerKey: string,
  methodKey: string,
  version?: string,
): string {
  const key = PLATFORM_SPLIT_CONTROLLER_KEYS.has(controllerKey)
    ? LEGACY_PLATFORM_CONTROLLER
    : controllerKey;
  return version ? `${key}_${methodKey}_${version}` : `${key}_${methodKey}`;
}

/** Preserve committed `openapi.json` path key order when controller registration order changes. */
export function reorderOpenApiPaths(
  document: OpenAPIObject,
  pathOrder: readonly string[],
): OpenAPIObject {
  const paths = document.paths ?? {};
  const ordered: PathsObject = {};
  for (const path of pathOrder) {
    const item = paths[path];
    if (item) {
      ordered[path] = item;
    }
  }
  for (const path of Object.keys(paths)) {
    if (!(path in ordered)) {
      const item = paths[path];
      if (item) {
        ordered[path] = item;
      }
    }
  }
  return { ...document, paths: ordered };
}

/** Preserve committed `components.schemas` key order when `@ApiExtraModels` registration order changes. */
export function reorderOpenApiSchemas(
  document: OpenAPIObject,
  schemaOrder: readonly string[],
): OpenAPIObject {
  const schemas = document.components?.schemas;
  if (!schemas || schemaOrder.length === 0) {
    return document;
  }
  const ordered: Record<string, (typeof schemas)[string]> = {};
  for (const key of schemaOrder) {
    const item = schemas[key];
    if (item) {
      ordered[key] = item;
    }
  }
  for (const key of Object.keys(schemas)) {
    if (!(key in ordered)) {
      const item = schemas[key];
      if (item) {
        ordered[key] = item;
      }
    }
  }
  return {
    ...document,
    components: {
      ...document.components,
      schemas: ordered,
    },
  };
}
