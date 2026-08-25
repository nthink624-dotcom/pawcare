import { Mastra } from "@mastra/core/mastra";
import { MastraAuthStudio } from "@mastra/auth-studio";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";

import { petmanagerGrowthReviewWorkflow } from "./workflows/petmanager-growth-review";

const isDevelopment = process.env.NODE_ENV === "development";
const databaseUrl = process.env.TURSO_DATABASE_URL?.trim() || "file:./marketing-agent.db";
const databaseAuthToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
const organizationId = process.env.MASTRA_ORGANIZATION_ID?.trim();

if (!isDevelopment && databaseUrl.startsWith("file:")) {
  throw new Error("A remote TURSO_DATABASE_URL is required outside local development.");
}

if (!databaseUrl.startsWith("file:") && !databaseAuthToken) {
  throw new Error("TURSO_AUTH_TOKEN is required for remote Mastra storage.");
}

if (!isDevelopment && !organizationId) {
  throw new Error("MASTRA_ORGANIZATION_ID is required for deployed Studio authentication.");
}

export const mastra = new Mastra({
  workflows: {
    petmanagerGrowthReviewWorkflow,
  },
  storage: new LibSQLStore({
    id: "petmanager-marketing-poc-storage",
    url: databaseUrl,
    authToken: databaseAuthToken,
  }),
  logger: new PinoLogger({
    name: "PetManager Marketing POC",
    level: "info",
  }),
  server: {
    // Local Studio stays localhost-only. Deployed Studio/API use the same
    // Google-backed Mastra Platform session as the project dashboard.
    auth: isDevelopment
      ? undefined
      : new MastraAuthStudio({
          organizationId: organizationId!,
        }),
  },
});
