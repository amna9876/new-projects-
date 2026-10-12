/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting and type checking run as their own tasks (`pnpm lint`, `pnpm typecheck`).
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
