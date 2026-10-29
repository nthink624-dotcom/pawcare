export type OwnerEntryShop = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

export type OwnerEntryPayload<TBootstrap, TSubscription> = {
  version: 1;
  bootstrap: TBootstrap;
  shops: OwnerEntryShop[];
  subscriptionSummary: TSubscription | null;
};
