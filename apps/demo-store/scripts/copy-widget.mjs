// Copies the built widget into public/, so the storefront serves it at /widget.js
// exactly as a real store would host it alongside its own static files.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../../packages/widget/dist/widget.js', import.meta.url));
const target = fileURLToPath(new URL('../public/widget.js', import.meta.url));

if (!existsSync(source)) {
  console.error(
    'packages/widget/dist/widget.js is missing. Run `pnpm build` in the repository root first.',
  );
  process.exit(1);
}
mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
copyFileSync(source, target);
console.log('Copied widget.js into public/');
