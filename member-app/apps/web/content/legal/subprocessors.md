---
title: Subprocessors
---

# Subprocessors

**Last Updated:** January 7, 2025  
**Effective Date:** January 2025  
**Company:** LifePreneur, LLC  
**Address:** 6100 W Gila Springs Pl, Suite 25, Chandler, AZ 85226  
**Contact:** support@lifepreneur.com

## 1. OVERVIEW

This page lists the third-party service providers ("Subprocessors") that LifePreneur, LLC uses to deliver and operate _TikTok Shop For Creators by LifePreneur_ (the "Platform").

These subprocessors may have access to or process your personal data on our behalf as part of providing the Platform's functionality.

**Our Commitment:** We carefully select subprocessors based on their:
- Security practices and data protection standards
- GDPR and privacy regulation compliance
- Reliability and service quality
- Transparent privacy policies

**For complete details on how we collect, use, and protect your data, see our [Privacy Policy](/legal/privacy-policy).**

## 2. LEGAL BASIS & COMPLIANCE

### 2.1 Data Processing Agreements

We maintain **Data Processing Agreements (DPAs)** or similar contractual protections with all subprocessors that handle personal data. These agreements ensure:

- Compliance with GDPR, CCPA, and applicable privacy laws
- Appropriate security measures to protect your data
- Limitation of data use to specified purposes only
- Prohibition of unauthorized data sharing
- Notification of security breaches
- Deletion of data upon request or contract termination

### 2.2 Standard Contractual Clauses

For subprocessors located outside the European Economic Area (EEA), we use **EU Standard Contractual Clauses (SCCs)** or rely on adequacy decisions to ensure GDPR-compliant data transfers.

### 2.3 Your Rights

Your privacy rights (access, deletion, portability, etc.) extend to data processed by our subprocessors. To exercise your rights, contact us at support@lifepreneur.com, and we will coordinate with the relevant subprocessor.

**For complete details on your rights, see Section 10 of our [Privacy Policy](/legal/privacy-policy).**

## 3. ACTIVE SUBPROCESSORS

The following subprocessors are **currently active** and may process your personal data:

### Infrastructure & Hosting

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Vercel** | Platform hosting and infrastructure | Application data, logs, metadata, session data, all user-provided information | Global (US, EU) | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |
| **PostgreSQL Database** | Data storage and management | Account data, subscription records, user preferences, all Platform data | Secure cloud infrastructure (US) | Self-managed with encryption |
| **AWS S3 / Cloudflare R2** | File storage (avatars, uploads) | Profile images, testimonial images, user-uploaded files | Global (US, EU) | [AWS Privacy](https://aws.amazon.com/privacy/) / [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/) |

**Notes:**
- Vercel hosts our entire Platform and has access to all data necessary for operation
- PostgreSQL is our primary database, encrypted at rest and in transit
- S3-compatible storage is used only for file uploads (avatars, testimonials)

### Authentication & Security

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Better Auth** | User authentication and session management | Email addresses, encrypted passwords, session tokens, login history, security events | Self-hosted (data stays on our servers) | [better-auth.com](https://www.better-auth.com) |

**Notes:**
- Better Auth is an open-source authentication library
- All authentication data is stored on our own servers (not third-party)
- Passwords are hashed with bcrypt and never stored in plain text

### Payment Processing

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Stripe** | Customer payment processing and subscription management | Payment card details, billing name, email, address, transaction history, subscription status | Global (US, EU) - GDPR compliant | [stripe.com/privacy](https://stripe.com/privacy) |
| **PayPal** | Affiliate commission payouts | Email address, payout amount, affiliate earnings records | Global (US, EU) | [paypal.com/privacy](https://www.paypal.com/us/legalhub/privacy-full) |

**Notes:**
- Stripe handles ALL customer payments (subscriptions and one-time purchases)
- We do not store full payment card details - Stripe securely stores them
- PayPal is used ONLY for affiliate commission payouts, NOT customer payments
- Payment data is encrypted and PCI-DSS compliant

### Community & Communication

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Discord** | Private community access and member interaction | Discord username, user ID, profile information, server messages, reactions, participation data | Global (US, EU) | [discord.com/privacy](https://discord.com/privacy) |
| **Email Providers** (Resend, Postmark, Mailgun, or Plunk) | Transactional and marketing emails | Email addresses, names, email content, delivery status, open/click rates | Global (US, EU) | Provider-specific (see below) |

**Email Provider Privacy Policies:**
- Resend: [resend.com/legal/privacy-policy](https://resend.com/legal/privacy-policy)
- Postmark: [postmarkapp.com/privacy-policy](https://postmarkapp.com/privacy-policy)
- Mailgun: [mailgun.com/legal/privacy-policy](https://www.mailgun.com/legal/privacy-policy/)
- Plunk: [useplunk.com/privacy](https://www.useplunk.com/privacy)

**Notes:**
- Discord hosts your community messages and profile - subject to Discord's privacy policy
- We use one of the listed email providers (configuration may vary)
- You can unsubscribe from marketing emails; transactional emails are required for service

### Affiliate Program

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Rewardful** | Affiliate referral tracking and commission management | Referral codes, affiliate IDs, conversion data, commission records, affiliate dashboard access | Global (US, EU) | [getrewardful.com/privacy](https://getrewardful.com/privacy) |

**Notes:**
- Rewardful tracks referrals via cookies (see our [Cookie Policy](/legal/cookies))
- Only active if you use an affiliate link or become an affiliate
- Processes affiliate earnings and referral attribution data

### Analytics (Optional - Requires Your Consent)

| Vendor | Purpose | Data Processed | Location | Privacy Policy |
|--------|---------|----------------|----------|----------------|
| **Vercel Analytics** | Privacy-friendly anonymous usage statistics | Page URLs, referrer, browser type, device type, geographic region (country/city level) | Global (US, EU) | [vercel.com/docs/analytics/privacy-policy](https://vercel.com/docs/analytics/privacy-policy) |

**Notes:**
- **Privacy-friendly:** Server-side tracking, no cookies in your browser
- **Does NOT collect:** IP addresses, user identifiers, cross-site tracking data, personal information
- **Default:** Disabled until you consent via our cookie banner
- **Control:** You can opt out at any time via cookie preferences

## 4. PLANNED FUTURE SUBPROCESSORS (Not Currently Active)

We may add the following subprocessors in the future to enhance the Platform. **We will update this page and notify you BEFORE activation.**

### Marketing & Advertising (Planned)

| Vendor | Purpose | Data Types (When Active) | Location | Privacy Policy |
|--------|---------|---------------------------|----------|----------------|
| **Google Analytics** | Website analytics and user behavior tracking | Page views, user behavior, traffic sources, device information, geographic data | Global (US, EU) | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **Google Ads** | Paid advertising campaigns and conversion tracking | Advertising data, conversion tracking, user behavior, retargeting data | Global (US, EU) | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **Meta (Facebook) Pixel** | Facebook/Instagram advertising and retargeting | Pixel tracking data, conversion data, retargeting audiences, user behavior | Global (US, EU) | [facebook.com/privacy/policy](https://www.facebook.com/privacy/policy) |
| **TikTok Pixel** | TikTok advertising and conversion tracking | Pixel tracking data, conversion data, user behavior, advertising metrics | Global (US, EU) | [tiktok.com/legal/privacy-policy](https://www.tiktok.com/legal/privacy-policy) |

**Important:** These services are **NOT currently active**. If and when we implement them:

✅ **We will notify you via email or Platform announcement**  
✅ **We will update this page with the "Last Updated" date**  
✅ **We will request fresh consent via our cookie banner (where required by law)**  
✅ **You will have the option to opt out**

**See Section 16 of our [Privacy Policy](/legal/privacy-policy) for details on future integrations.**

## 5. SUBPROCESSOR CATEGORIES

### Essential Subprocessors

**Required to provide the Platform** (cannot opt out):
- Vercel (hosting)
- PostgreSQL (database)
- Better Auth (authentication)
- Stripe (payment processing)
- Discord (community access)
- Email providers (transactional emails)

**Legal Basis:** Contract performance (GDPR Article 6(1)(b)) - necessary to deliver the Service you purchased.

### Affiliate & Attribution Subprocessors

**Required for business operations**:
- Rewardful (affiliate tracking)
- PayPal (affiliate payouts)

**Legal Basis:** Legitimate business interest (GDPR Article 6(1)(f)) - necessary to fairly compensate creators who refer members.

**Note:** Only active if you use an affiliate link or become an affiliate.

### Optional Subprocessors

**Require your consent**:
- Vercel Analytics (privacy-friendly usage statistics)
- Future marketing/advertising tools (Google Ads, Meta Pixel, TikTok Pixel)

**Legal Basis:** Consent (GDPR Article 6(1)(a)) - can be withdrawn at any time without affecting Platform access.

**Control:** Manage preferences via our cookie banner or contact support@lifepreneur.com.

## 6. DATA SECURITY & PROTECTION

All subprocessors are required to maintain appropriate security measures, including:

✅ **Encryption:** Data encrypted in transit (TLS/SSL) and at rest  
✅ **Access Controls:** Limited access on need-to-know basis  
✅ **Security Audits:** Regular security assessments and compliance checks  
✅ **Incident Response:** Procedures for detecting and responding to security breaches  
✅ **Data Minimization:** Only process data necessary for specified purposes  
✅ **Contractual Obligations:** Written agreements requiring GDPR/CCPA compliance

**For complete details on our security measures, see Section 9 of our [Privacy Policy](/legal/privacy-policy).**

## 7. SUBPROCESSOR CHANGES

### 7.1 Adding New Subprocessors

When we engage a new subprocessor:
- We will update this page with the new subprocessor details
- The "Last Updated" date at the top will change
- For material changes, we will notify you via email or Platform announcement
- For services requiring consent, we will request your permission before activation

### 7.2 Removing Subprocessors

When we discontinue a subprocessor:
- We will update this page to reflect the change
- Data will be deleted or transferred according to our retention policies
- You will be notified if the change affects your access or experience

### 7.3 Changing Subprocessor Terms

If a subprocessor significantly changes their privacy practices or terms:
- We will review the changes for compliance with our standards
- We may terminate the relationship if standards are not met
- We will notify you of any material changes that affect your data

## 8. YOUR DATA PROTECTION RIGHTS

You have important rights regarding data processed by our subprocessors:

### EU/UK Users (GDPR Rights)

- **Access:** Request information about which subprocessors process your data
- **Deletion:** Request deletion of your data (subject to legal retention requirements)
- **Portability:** Receive your data in machine-readable format
- **Objection:** Object to processing based on legitimate interests
- **Restriction:** Request restriction of certain processing activities
- **Complaint:** Lodge a complaint with your Data Protection Authority

### California Users (CCPA Rights)

- **Know:** Know which subprocessors have access to your personal information
- **Delete:** Request deletion of your personal information
- **Opt-Out:** Opt out of sale of personal information (we do not sell your data)
- **Non-Discrimination:** Equal service regardless of privacy choices

### How to Exercise Your Rights

**Email:** support@lifepreneur.com with "Privacy Request" in subject line

**Include:**
- Your name and email associated with your account
- Specific request (e.g., "list all subprocessors processing my data")
- Verification information (we may ask security questions)

**Response Time:** 30 days for GDPR requests, 45 days for CCPA requests

## 9. INTERNATIONAL DATA TRANSFERS

### 9.1 Data Transfer Mechanisms

Most of our subprocessors are located in the **United States**. If you are located in the EU/UK or other regions with data protection laws, your data will be transferred internationally.

**We ensure appropriate safeguards:**
- EU Standard Contractual Clauses (SCCs) with all EU data processors
- GDPR compliance requirements in all subprocessor agreements
- Encryption of data in transit and at rest
- Regular compliance audits

### 9.2 Subprocessor Locations

**United States:** Vercel, Stripe, Discord, Rewardful, email providers, Better Auth (self-hosted)

**Global (with EU presence):** Most subprocessors have infrastructure in both US and EU regions

**Your Rights:** EU/UK users retain all GDPR rights regardless of where subprocessors are located.

## 10. THIRD-PARTY PRIVACY POLICIES

Each subprocessor has its own privacy policy governing how they collect, use, and protect data:

**We recommend reviewing the privacy policies of:**
- Discord (if you join our community): [discord.com/privacy](https://discord.com/privacy)
- Stripe (if you subscribe): [stripe.com/privacy](https://stripe.com/privacy)
- Rewardful (if you use affiliate links): [getrewardful.com/privacy](https://getrewardful.com/privacy)

**Important:** We are not responsible for the privacy practices of third-party subprocessors. Each service operates under its own privacy policy and terms of service.

## 11. COOKIES & TRACKING

Some subprocessors may use cookies or tracking technologies. For complete details, see our **[Cookie Policy](/legal/cookies)**, which explains:

- What cookies are used by each subprocessor
- How to manage cookie preferences
- Which cookies require your consent
- How to opt out of optional tracking

**Key Points:**
- **Rewardful** uses cookies for affiliate tracking (essential for business operations)
- **Vercel Analytics** uses server-side tracking (no cookies in your browser)
- **Discord** may use cookies when you access the community
- **Future advertising services** will use pixels/cookies (requires your consent)

## 12. DATA RETENTION BY SUBPROCESSORS

Subprocessors retain data according to their own retention policies and our contractual requirements:

**General Retention Periods:**
- **Vercel:** Data retained as long as your account is active
- **Stripe:** Payment records retained for 7+ years (legal/tax compliance)
- **Discord:** Messages retained indefinitely unless deleted by you or moderators
- **Rewardful:** Affiliate data retained for 7 years (tax compliance)
- **Email providers:** Delivery logs typically 30-90 days
- **Analytics:** Aggregated data indefinitely; raw data 90 days

**Upon Account Deletion:**
- We instruct subprocessors to delete your data within 30-90 days
- Some data may be retained longer for legal/compliance requirements
- Anonymized data that cannot identify you may be retained indefinitely

**See Section 8 of our [Privacy Policy](/legal/privacy-policy) for complete retention details.**

## 13. SUBPROCESSOR LIABILITY

### 13.1 Our Responsibility

We are responsible for selecting, monitoring, and managing our subprocessors. We ensure they:
- Maintain appropriate security and privacy standards
- Comply with applicable data protection laws
- Process data only as instructed by us
- Protect your data with reasonable safeguards

### 13.2 Subprocessor Actions

While we carefully vet subprocessors, we cannot control their actions entirely:
- Service outages or technical issues may occur
- Privacy policies may change
- Security breaches may happen despite safeguards

**If a subprocessor experiences a data breach affecting your data:**
- We will be notified by the subprocessor
- We will notify you as required by law (typically within 72 hours for GDPR)
- We will take reasonable steps to mitigate harm
- We may terminate the subprocessor relationship if appropriate

### 13.3 Limitation of Liability

See Section 10 of our [Terms and Conditions](/legal/terms) for complete liability limitations.

## 14. CONTACT INFORMATION & QUESTIONS

For questions about our subprocessors or data processing practices:

**LifePreneur, LLC**  
6100 W Gila Springs Pl, Suite 25  
Chandler, AZ 85226  
United States

**Email:** support@lifepreneur.com  
**Website:** https://lifepreneur.com

**For Specific Inquiries:**
- **Subprocessor questions:** Subject line "Subprocessor Inquiry"
- **Privacy requests:** Subject line "Privacy Request"
- **Data deletion:** Subject line "Data Deletion Request"
- **GDPR/CCPA requests:** Subject line "GDPR Request" or "CCPA Request"

**Response Time:** We aim to respond to all inquiries within 2-3 business days.

---

**This Subprocessor list is designed to comply with GDPR Article 28, CCPA disclosure requirements, and transparency best practices.**

**We are committed to transparency about how your data is processed. If you have any concerns about our subprocessors, please contact us.**

*Last reviewed and verified accurate: January 7, 2025*
