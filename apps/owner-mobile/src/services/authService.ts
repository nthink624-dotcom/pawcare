export type OwnerSession = {
  ownerId: string;
  shopId: string;
};

export async function getCurrentOwnerSession(): Promise<OwnerSession | null> {
  return null;
}
