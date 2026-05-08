import type { OwnerDataProvider } from "@/services/ownerDataProvider";

export type OwnerDataStatus = "idle" | "loading" | "ready" | "error";

export type OwnerDataState =
  | {
      status: "idle";
      provider: null;
      error: null;
    }
  | {
      status: "loading";
      provider: null;
      error: null;
    }
  | {
      status: "ready";
      provider: OwnerDataProvider;
      error: null;
    }
  | {
      status: "error";
      provider: null;
      error: Error;
    };

export const initialOwnerDataState: OwnerDataState = {
  status: "idle",
  provider: null,
  error: null,
};
