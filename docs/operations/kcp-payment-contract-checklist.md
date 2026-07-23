# NHN KCP Payment Contract Checklist

Last updated: 2026-07-21

## Merchant And Service Names

- Legal merchant name for the KCP contract, insurance, and settlement: `넘친 Day`
- Customer-facing service and site name: `넘친Day 펫매니저`
- Website: `https://www.petmanager.co.kr`

## Completed by PetManager

- PortOne test channels are registered for KCP general payment and recurring billing.
- A server-only API billing-key issuance endpoint is prepared for the KCP non-auth recurring-billing contract.
- The endpoint forwards card credentials only to PortOne and persists only the encrypted billing key through the existing subscription storage flow.

## Required Owner Actions

1. Sign in to the two KCP partner-center accounts received by email and change both initial passwords.
2. Submit a card-company review request in `Customer Center > Customer Inquiry > Ask a Question`.
   - Inquiry type: `Card company registration request`
   - Request: `General payment + recurring billing review`
   - Service description: `넘친Day 펫매니저는 반려동물 미용샵 운영자를 위한 월 구독형 SaaS입니다.`
3. Submit online contract documents in `Store Information Management > Store Information > Contract Information`.
   - Complete contract consent, identity verification, then supporting-document upload.
4. Apply for a KRW 2,000,000 performance/payment guarantee insurance policy.
   - Contract name: `NHN KCP Electronic Payment Service Agreement`
   - KCP receives the policy automatically when issued by the Seoul Guarantee Insurance Mapo branch.

## Waiting For KCP

- Card-company review result for general payment and recurring billing.
- Production KCP API certificate/private key and production MID/channel details.

## Before Production Enablement

- Set production PortOne payment and recurring-billing channel keys.
- Set the KCP/PortOne production server secrets without committing them to git.
- Complete an owner-only live card-registration and initial-charge test.
- Verify billing-key encryption, payment result, cancellation, and webhook handling.
