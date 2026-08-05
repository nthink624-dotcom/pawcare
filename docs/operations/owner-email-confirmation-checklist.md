# Owner Email Confirmation Checklist

Owner signup requires both a KCP phone identity check and ownership confirmation of the login email address.

## Product flow

1. The owner enters an unused email address and a password.
2. The owner accepts the required terms, completes KCP phone identity verification, and enters shop information.
3. The server creates an unconfirmed Supabase Auth user and sends the Supabase signup-confirmation email.
4. The owner opens the link in the email, which redirects to `/login?message=email-confirmed`.
5. Password login stays blocked until `auth.users.email_confirmed_at` is set.

KCP proves the phone account holder's identity. It does not prove ownership of the email inbox.

## Required Supabase configuration

Complete these settings for both the Development and Production Supabase projects before enabling this flow:

1. In **Authentication > Providers > Email**, keep email signup enabled and enable email confirmation.
2. In **Authentication > URL Configuration**, set the production Site URL to `https://www.petmanager.co.kr` and allow the exact login redirect URLs used by each environment, including `/login?message=email-confirmed`.
3. Configure a verified custom SMTP sender. Supabase's default email provider is not suitable for a production service and may restrict delivery to project members.
4. In the confirmation email template, keep the Supabase `{{ .ConfirmationURL }}` link intact. Do not enable link-tracking URL rewriting for this email.

## Release verification

- Sign up with a mailbox that can receive mail. The response must say that email confirmation is required.
- Confirm the email link and verify the login page displays the confirmation-complete message.
- Verify login fails before email confirmation and succeeds after confirmation.
- Use the login screen's **인증 메일 다시 받기** action after a missing or expired email.
- Verify the redirect URL is accepted by Supabase in both Development and Production.
