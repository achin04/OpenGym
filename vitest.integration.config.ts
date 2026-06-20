import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.test" });

export default defineConfig({
    test: {
        include: ["src/**/*.integration.test.ts"],
        environment: "node",
        globals: false,
        fileParallelism: false,
    },
    resolve: {
        alias: {
            "@/": new URL("./src/", import.meta.url).pathname,
        },
    },
});