import { stringify } from 'yaml';
import { z } from 'zod';
import { pathParams, ROUTES, type OperationId } from './routes';
import {
  AddCartItemRequestSchema,
  AppliedDiscountSchema,
  ApplyDiscountRequestSchema,
  CartItemSchema,
  CartSchema,
  CartTotalsSchema,
  CheckoutUrlResponseSchema,
  CreateCartRequestSchema,
  UpdateCartItemRequestSchema,
} from './schemas/cart';
import { ErrorResponseSchema, MoneySchema } from './schemas/common';
import {
  ProductListQuerySchema,
  ProductListResponseSchema,
  ProductSchema,
  ProductVariantSchema,
} from './schemas/product';

type JsonObject = Record<string, unknown>;

/** Schemas published under `#/components/schemas`, keyed by component name. */
const COMPONENT_SCHEMAS = {
  Money: MoneySchema,
  ProductVariant: ProductVariantSchema,
  Product: ProductSchema,
  ProductListResponse: ProductListResponseSchema,
  CartItem: CartItemSchema,
  AppliedDiscount: AppliedDiscountSchema,
  CartTotals: CartTotalsSchema,
  Cart: CartSchema,
  CreateCartRequest: CreateCartRequestSchema,
  AddCartItemRequest: AddCartItemRequestSchema,
  UpdateCartItemRequest: UpdateCartItemRequestSchema,
  ApplyDiscountRequest: ApplyDiscountRequestSchema,
  CheckoutUrlResponse: CheckoutUrlResponseSchema,
  ErrorResponse: ErrorResponseSchema,
} as const;

type ComponentName = keyof typeof COMPONENT_SCHEMAS;

interface OperationSpec {
  summary: string;
  description?: string;
  tag: 'Products' | 'Carts';
  query?: z.ZodObject;
  body?: { schema: ComponentName; required: boolean };
  success: { status: number; schema: ComponentName; description: string };
  /** HTTP status to the error codes that may be returned with it. */
  errors: Record<number, string>;
}

const OPERATIONS: Record<OperationId, OperationSpec> = {
  listProducts: {
    summary: 'Search and filter products',
    tag: 'Products',
    query: ProductListQuerySchema,
    success: { status: 200, schema: 'ProductListResponse', description: 'One page of products.' },
    errors: { 400: '`validation_error`: a query parameter is invalid.' },
  },
  getProduct: {
    summary: 'Get one product',
    tag: 'Products',
    success: { status: 200, schema: 'Product', description: 'The product.' },
    errors: { 404: '`not_found`: no product has this id.' },
  },
  createCart: {
    summary: 'Create an empty cart',
    tag: 'Carts',
    body: { schema: 'CreateCartRequest', required: false },
    success: { status: 201, schema: 'Cart', description: 'The new, empty cart.' },
    errors: { 400: '`validation_error`: the body is invalid.' },
  },
  getCart: {
    summary: 'Get a cart',
    tag: 'Carts',
    success: { status: 200, schema: 'Cart', description: 'The cart.' },
    errors: { 404: '`not_found`: no cart has this id.' },
  },
  addCartItem: {
    summary: 'Add a product to a cart',
    description:
      'Adds `quantity` of a variant. When the product has more than one variant, `variantId` is required.',
    tag: 'Carts',
    body: { schema: 'AddCartItemRequest', required: true },
    success: { status: 200, schema: 'Cart', description: 'The updated cart.' },
    errors: {
      400: '`validation_error`: the body is invalid.',
      404: '`not_found`: the cart, product or variant does not exist.',
      409: '`variant_required`: the product has several variants and none was chosen. `out_of_stock`: the variant cannot be purchased.',
    },
  },
  updateCartItem: {
    summary: 'Change the quantity of a cart line',
    tag: 'Carts',
    body: { schema: 'UpdateCartItemRequest', required: true },
    success: { status: 200, schema: 'Cart', description: 'The updated cart.' },
    errors: {
      400: '`validation_error`: the body is invalid.',
      404: '`not_found`: the cart or line does not exist.',
      409: '`out_of_stock`: the variant can no longer be purchased.',
    },
  },
  removeCartItem: {
    summary: 'Remove a line from a cart',
    tag: 'Carts',
    success: { status: 200, schema: 'Cart', description: 'The updated cart.' },
    errors: { 404: '`not_found`: the cart or line does not exist.' },
  },
  applyDiscount: {
    summary: 'Apply a discount code',
    description:
      'The store validates the code and returns the cart with updated totals, or a clear error.',
    tag: 'Carts',
    body: { schema: 'ApplyDiscountRequest', required: true },
    success: { status: 200, schema: 'Cart', description: 'The cart with the discount applied.' },
    errors: {
      400: '`validation_error`: the body is invalid.',
      404: '`not_found`: no cart has this id.',
      422: '`discount_invalid`, `discount_expired` or `discount_min_not_met`: the code was rejected.',
    },
  },
  getCheckoutUrl: {
    summary: 'Get the checkout hand-off link',
    description: 'The shopper pays on the store itself. The agent never handles payment.',
    tag: 'Carts',
    success: { status: 200, schema: 'CheckoutUrlResponse', description: 'The checkout link.' },
    errors: {
      404: '`not_found`: no cart has this id.',
      409: '`cart_empty`: the cart has no items.',
    },
  },
};

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

const componentRef = (name: string) => `#/components/schemas/${name}`;

/** Removes JSON Schema bookkeeping keys that do not belong inside an OpenAPI document. */
function stripMeta(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMeta);
  if (value === null || typeof value !== 'object') return value;
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === '$schema' || key === '$id') continue;
    // Zod emits JavaScript's safe-integer range for every integer; that is noise in an API spec.
    if ((key === 'minimum' || key === 'maximum') && Math.abs(Number(child)) === MAX_SAFE) continue;
    result[key] = stripMeta(child);
  }
  return result;
}

function buildComponentSchemas(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [name, schema] of Object.entries(COMPONENT_SCHEMAS)) {
    registry.add(schema, { id: name });
  }
  const { schemas } = z.toJSONSchema(registry, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
    uri: componentRef,
  });
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(COMPONENT_SCHEMAS)) {
    result[name] = stripMeta(schemas[name]);
  }
  return result;
}

function buildQueryParameters(query: z.ZodObject): JsonObject[] {
  const shape = query.shape as Record<string, z.ZodType>;
  return Object.entries(shape).map(([name, field]) => {
    const { description, ...schema } = stripMeta(
      z.toJSONSchema(field, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' }),
    ) as JsonObject;
    return {
      name,
      in: 'query',
      required: !field.safeParse(undefined).success,
      ...(typeof description === 'string' ? { description } : {}),
      schema,
    };
  });
}

function jsonContent(schema: ComponentName | 'ErrorResponse'): JsonObject {
  return { 'application/json': { schema: { $ref: componentRef(schema) } } };
}

function buildOperation(operationId: OperationId): JsonObject {
  const spec = OPERATIONS[operationId];
  const route = ROUTES[operationId];

  const parameters: JsonObject[] = [
    ...pathParams(route.path).map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })),
    ...(spec.query ? buildQueryParameters(spec.query) : []),
  ];

  const responses: JsonObject = {
    [spec.success.status]: {
      description: spec.success.description,
      content: jsonContent(spec.success.schema),
    },
  };
  const errors: Record<number, string> = {
    ...spec.errors,
    401: '`unauthorized`: the store requires an API key and it was missing or wrong.',
  };
  for (const [status, description] of Object.entries(errors)) {
    responses[status] = { description, content: jsonContent('ErrorResponse') };
  }

  return {
    operationId,
    summary: spec.summary,
    ...(spec.description ? { description: spec.description } : {}),
    tags: [spec.tag],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(spec.body
      ? { requestBody: { required: spec.body.required, content: jsonContent(spec.body.schema) } }
      : {}),
    responses,
  };
}

/** Builds the OpenAPI 3.1 document for the Store API from the Zod schemas. */
export function buildOpenApiDocument(): JsonObject {
  const paths: Record<string, JsonObject> = {};
  for (const operationId of Object.keys(ROUTES) as OperationId[]) {
    const route = ROUTES[operationId];
    const pathItem = (paths[route.path] ??= {});
    pathItem[route.method.toLowerCase()] = buildOperation(operationId);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Agentic Shopping Assistant: Store API',
      version: '0.1.0',
      description:
        'The REST contract a store implements so the shopping agent can search products, manage a cart, apply discount codes and hand off to checkout. All prices, stock and discounts are computed by the store.',
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: [{ url: 'http://localhost:4000', description: 'Bundled mock store' }],
    tags: [{ name: 'Products' }, { name: 'Carts' }],
    security: [{}, { bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Optional. Stores may require `Authorization: Bearer <STORE_API_KEY>`.',
        },
      },
      schemas: buildComponentSchemas(),
    },
  };
}

const YAML_HEADER =
  '# GENERATED FILE. Do not edit by hand.\n' +
  '# Source: packages/api-contract/src (Zod schemas). Regenerate with:\n' +
  '#   pnpm --filter @agentic-shop/api-contract openapi:generate\n';

export function renderOpenApiYaml(): string {
  return YAML_HEADER + stringify(buildOpenApiDocument(), { lineWidth: 100 });
}
