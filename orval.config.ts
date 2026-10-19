import { defineConfig } from "orval";

export default defineConfig({
  gestaoProjetos: {
    input: {
      target: "http://localhost:3000/swagger.json",
    },
    output: {
      mode: "tags-split",
      target: "src/lib/api/generated",
      schemas: "src/lib/api/generated/model",
      client: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "src/lib/api/fetcher.ts",
          name: "apiFetcher",
        },
      },
    },
  },
});
