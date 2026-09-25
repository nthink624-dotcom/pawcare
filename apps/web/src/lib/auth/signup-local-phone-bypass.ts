export function shouldBypassSignupPhoneVerification({
  nodeEnv,
  hostname,
}: {
  nodeEnv: string | undefined;
  hostname: string;
}) {
  return nodeEnv !== "production" && hostname === "127.0.0.1";
}
