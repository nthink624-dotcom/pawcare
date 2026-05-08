import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import type { OwnerDataState } from "@/services/ownerDataState";

export type OwnerDataProviderLoader = () => OwnerDataProvider | Promise<OwnerDataProvider>;

export type RunOwnerDataProviderLoadOptions = {
  loadProvider: OwnerDataProviderLoader;
  onState: (state: OwnerDataState) => void;
};

export function runOwnerDataProviderLoad({ loadProvider, onState }: RunOwnerDataProviderLoadOptions) {
  let active = true;

  onState({
    status: "loading",
    provider: null,
    error: null,
  });

  Promise.resolve()
    .then(loadProvider)
    .then((provider) => {
      if (!active) return;

      onState({
        status: "ready",
        provider,
        error: null,
      });
    })
    .catch((error: unknown) => {
      if (!active) return;

      onState({
        status: "error",
        provider: null,
        error: error instanceof Error ? error : new Error("Failed to load owner data."),
      });
    });

  return () => {
    active = false;
  };
}
