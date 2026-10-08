import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument, renderOpenApiYaml, ROUTES } from '../src/index';

type Json = Record<string, unknown>;

const document = buildOpenApiDocument();
const paths = document.paths as Record<string, Record<string, Json>>;
const components = (document.components as { schemas: Record<string, Json> }).schemas;

function collectRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const child of value) collectRefs(child, refs);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') refs.push(child);
      else collectRefs(child, refs);
    }
  }
  return refs;
}

describe('OpenAPI document', () => {
  it('declares OpenAPI 3.1', () => {
    expect(document.openapi).toMatch(/^3\.1\.\d+$/);
  });

  it('describes every route of the contract', () => {
    for (const [operationId, route] of Object.entries(ROUTES)) {
      const operation = paths[route.path]?.[route.method.toLowerCase()];
      expect(operation, `${route.method} ${route.path}`).toBeDefined();
      expect(operation?.operationId).toBe(operationId);
    }
    const documented = Object.values(paths).flatMap((item) => Object.keys(item));
    expect(documented).toHaveLength(Object.keys(ROUTES).length);
  });

  it('only contains references that resolve to a component', () => {
    const refs = collectRefs(document);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\/schemas\//);
      expect(components, ref).toHaveProperty(ref.replace('#/components/schemas/', ''));
    }
  });

  it('declares every path parameter', () => {
    for (const [path, item] of Object.entries(paths)) {
      const expected = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      for (const operation of Object.values(item)) {
        const declared = ((operation.parameters as Json[] | undefined) ?? [])
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => parameter.name);
        expect(declared).toEqual(expected);
      }
    }
  });

  it('documents the product search parameters', () => {
    const parameters = paths['/products']?.get?.parameters as Json[];
    expect(parameters.map((parameter) => parameter.name)).toEqual([
      'query',
      'category',
      'minPrice',
      'maxPrice',
      'inStock',
      'sort',
      'limit',
      'cursor',
    ]);
    expect(parameters.every((parameter) => parameter.required === false)).toBe(true);
  });

  it('leaves no JSON Schema bookkeeping keys behind', () => {
    const yaml = renderOpenApiYaml();
    expect(yaml).not.toContain('$schema');
    expect(yaml).not.toContain('$defs');
    expect(yaml).not.toContain('$id');
  });

  it('matches the committed openapi/openapi.yaml', () => {
    const committed = readFileSync(
      fileURLToPath(new URL('../openapi/openapi.yaml', import.meta.url)),
      'utf8',
    ).replace(/\r\n/g, '\n');
    expect(
      committed,
      'Run `pnpm --filter @agentic-shop/api-contract openapi:generate` and commit the result.',
    ).toBe(renderOpenApiYaml());
  });
});
