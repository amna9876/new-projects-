import { ProductListQuerySchema, ROUTES } from '@agentic-shop/api-contract';
import { Hono } from 'hono';
import type { MockStore } from '../store';
import { honoPath, param } from './util';

export function productRoutes(store: MockStore): Hono {
  const app = new Hono();

  app.get(honoPath(ROUTES.listProducts.path), (c) => {
    const query = ProductListQuerySchema.parse(c.req.query());
    return c.json(store.listProducts(query));
  });

  app.get(honoPath(ROUTES.getProduct.path), (c) => c.json(store.getProduct(param(c, 'id'))));

  return app;
}
