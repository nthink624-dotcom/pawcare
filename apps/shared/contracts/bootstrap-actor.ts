/** Server-authorized actor; never supplied by a client mutation or inferred from profile presence. */
export type BootstrapActor = { shopId: string; role: "owner" | "manager" | "staff"; staffId: string | null; userId?: string };
