import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O indicador do Next.js (só em desenvolvimento) ficava sobre o cabeçalho; vai para o canto inferior direito.
  devIndicators: { position: "bottom-right" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
