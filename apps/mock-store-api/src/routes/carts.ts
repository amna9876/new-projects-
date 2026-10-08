import {
  AddCartItemRequestSchema,
  ApplyDiscountRequestSchema,
  CreateCartRequestSchema,
  ROUTES,
  UpdateCartItemRequestSchema,
} from '@agentic-shop/api-contract';
import { Hono } from 'hono';
import type { MockStore } from '../store';
import { honoPath, param, readJsonBody } from './util';

export function cartRoutes(store: MockStore): Hono {
  const app = new Hono();

  app.post(honoPath(ROUTES.createCart.path), async (c) => {
    const body = CreateCartRequestSchema.parse(await readJsonBody(c));
    return c.json(store.createCart(body.currency), 201);
  });

  app.get(honoPath(ROUTES.getCart.path), (c) => c.json(store.getCart(param(c, 'id'))));

  app.post(honoPath(ROUTES.addCartItem.path), async (c) => {
    const body = AddCartItemRequestSchema.parse(await readJsonBody(c));
    return c.json(store.addItem(param(c, 'id'), body));
  });

  app.patch(honoPath(ROUTES.updateCartItem.path), async (c) => {
    const body = UpdateCartItemRequestSchema.parse(await readJsonBody(c));
    return c.json(store.updateItem(param(c, 'id'), param(c, 'itemId'), body.quantity));
  });

  app.delete(honoPath(ROUTES.removeCartItem.path), (c) =>
    c.json(store.removeItem(param(c, 'id'), param(c, 'itemId'))),
  );

  app.post(honoPath(ROUTES.applyDiscount.path), async (c) => {
    const body = ApplyDiscountRequestSchema.parse(await readJsonBody(c));
    return c.json(store.applyDiscount(param(c, 'id'), body.code));
  });

  app.get(honoPath(ROUTES.getCheckoutUrl.path), (c) => c.json(store.checkoutUrl(param(c, 'id'))));

  return app;
}
