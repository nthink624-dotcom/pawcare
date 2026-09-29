# Request correlation contract

The web and mobile liveness/readiness endpoints create or propagate a bounded
`x-request-id` value. The same value is returned in the JSON body and response
header, and is included in readiness operational events. Incoming values are
accepted only when they match the allowlisted identifier pattern and are at
most 128 characters; invalid values are replaced with a new UUID.

This identifier is diagnostic metadata only. It must not contain customer
data, authentication material, phone numbers, email addresses, or request
bodies. The endpoints remain `no-store`, and readiness still uses a bounded
two-second Supabase probe.

The Alimtalk web and mobile providers also send this identifier to the relay.
The relay echoes a valid value on every response and replaces malformed or
oversized values with a new UUID. Relay response bodies and authentication
headers remain unchanged.
