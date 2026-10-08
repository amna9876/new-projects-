import { defineContractTests } from '../src/contract-tests/index';

/**
 * Entry point for `pnpm contract:test`: verifies that the store at
 * STORE_API_BASE_URL implements the Store API contract.
 */
const baseUrl = process.env.STORE_API_BASE_URL;
if (!baseUrl) {
  throw new Error('Set STORE_API_BASE_URL to the base URL of the store you want to verify.');
}

defineContractTests({
  baseUrl,
  apiKey: process.env.STORE_API_KEY ?? undefined,
  fixtures: {
    validDiscountCode: process.env.CONTRACT_VALID_DISCOUNT_CODE ?? undefined,
  },
});
