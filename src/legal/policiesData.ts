import {
  LEGAL_CONFIG,
  THIRD_PARTY_SERVICES_AUDIT,
  STORAGE_KEYS_AUDIT,
} from './config';

export type LegalDocId =
  | 'legal'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'acceptable-use'
  | 'cookies'
  | 'contact';

export type LegalDocumentId = LegalDocId;

export interface PolicyTableData {
  headers: string[];
  rows: string[][];
}

export interface PolicySection {
  id: string;
  number: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: {
    title: string;
    body: string;
  };
  table?: PolicyTableData;
}

export interface PolicyDocument {
  id: LegalDocId;
  path: string;
  title: string;
  pageTitle: string;
  metaDescription: string;
  kicker: string;
  subtitle: string;
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  shortVersionBullets: string[];
  sections: PolicySection[];
  versionHistory: Array<{
    version: string;
    date: string;
    changes: string;
  }>;
}

export type LegalDocumentData = PolicyDocument;

export const LEGAL_DOCUMENTS: Record<LegalDocId, PolicyDocument> = {
  legal: {
    id: 'legal',
    path: '/legal',
    title: 'Legal, Trust & Safety Hub',
    pageTitle: `Legal Hub · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Official Terms of Service, Privacy Policy, Refund & Cancellation Policy, Acceptable Use Policy, Cookie Notice, and Contact & Grievance Officer details for ${LEGAL_CONFIG.TRADE_NAME}.`,
    kicker: 'TRUST, SAFETY & GOVERNANCE',
    subtitle: `Comprehensive terms, privacy disclosures, Dodo Payments Merchant of Record refund policies, and safety standards governing ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}).`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `${LEGAL_CONFIG.TRADE_NAME} is an independent SaaS platform operated by ${LEGAL_CONFIG.OPERATOR_NAME} (${LEGAL_CONFIG.ADDRESS}).`,
      `Your prompts, PDFs, and study materials are never sold and are never used by ${LEGAL_CONFIG.TRADE_NAME} to train foundation AI models.`,
      `Paid subscriptions (${LEGAL_CONFIG.PRICE}) are processed by Dodo Payments as our Merchant of Record, backed by a ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day first-purchase refund window.`,
      `We comply with India's Digital Personal Data Protection Act 2023 (DPDP Act), Information Technology Act 2000, IT Rules 2021, and international GDPR-standard data rights.`,
      `Upload standards prohibit uploading photos of real people, government IDs (Aadhaar, PAN), financial credentials, or explicit content.`,
    ],
    sections: [
      {
        id: 'overview',
        number: '01',
        title: 'What Kinich Does',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}) is an AI-powered research and study platform offering real-time AI search with cited web sources, autonomous Deep Research reports, a YouTube Study workspace (timestamped transcripts, structured summaries, interactive quizzes, flashcards, lesson plans, and audio summaries), persistent chat history, PDF and document study uploads, guest mode, user accounts via Email and Google sign-in, daily study streaks and achievement badges, a referral program with usage rewards, and optional paid subscription plans.`,
          `AI responses and study syntheses are generated using third-party large language model providers (including Google Gemini, DeepSeek, and OpenRouter/TokenHarbor-routed models). Subscription payments and taxes are processed by Dodo Payments acting as Merchant of Record.`,
        ],
      },
      {
        id: 'policies-directory',
        number: '02',
        title: 'Core Policies & Notices',
        table: {
          headers: ['Document', 'Route', 'Scope & Summary'],
          rows: [
            [
              'Terms of Service',
              '/terms',
              'Binding service agreement covering eligibility (18+), AI output disclaimers, ownership of your content, subscription billing, referral rules, liability limits, and governing law.',
            ],
            [
              'Privacy Policy',
              '/privacy',
              'DPDP Act 2023 & GDPR-aligned disclosure of what data we collect, how AI providers process prompts, retention schedules, subprocessors, and your data rights.',
            ],
            [
              'Refund & Cancellation Policy',
              '/refund',
              `Dodo Payments Merchant of Record billing terms, ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day satisfaction guarantee on first subscription purchases, renewal rules, and one-click cancellation.`,
            ],
            [
              'Acceptable Use & Content Policy',
              '/acceptable-use',
              'Zero-tolerance prohibitions on CSAM, non-consensual imagery, photos of identifiable people, sensitive IDs (Aadhaar/PAN/cards), exam cheating, and our enforcement ladder.',
            ],
            [
              'Cookie & LocalStorage Notice',
              '/cookies',
              'Complete inventory of browser cookies and localStorage keys used for authentication, preferences, and 30-day referral attribution.',
            ],
            [
              'Contact & Grievance Officer',
              '/contact',
              `Support channels (${LEGAL_CONFIG.SUPPORT_EMAIL}), Grievance Officer contact (${LEGAL_CONFIG.GRIEVANCE_EMAIL}), copyright takedowns, and interactive support ticket submission.`,
            ],
          ],
        },
      },
      {
        id: 'operator-and-grievance',
        number: '03',
        title: 'Operator & Statutory Grievance Officer (India)',
        paragraphs: [
          `In accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, details of the Data Fiduciary and Grievance Officer are published below:`,
        ],
        bullets: [
          `Operator / Data Fiduciary: ${LEGAL_CONFIG.OPERATOR_NAME} (operating the "${LEGAL_CONFIG.TRADE_NAME}" SaaS)`,
          `Operational Location: ${LEGAL_CONFIG.ADDRESS}`,
          `General & Billing Support: ${LEGAL_CONFIG.SUPPORT_EMAIL} (Target response: within 24–48 hours)`,
          `Grievance Officer & Privacy Contact: ${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME} — ${LEGAL_CONFIG.GRIEVANCE_EMAIL} (Acknowledgment within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours; resolution within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} days)`,
        ],
      },
      {
        id: 'review-status',
        number: '04',
        title: 'Policy Drafting & Review Status',
        paragraphs: [
          `These policies were drafted specifically for ${LEGAL_CONFIG.TRADE_NAME}'s product architecture, data flows, and payment integrations and are currently marked as: ${LEGAL_CONFIG.LEGAL_REVIEW_STATUS}.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Published unified Legal, Trust & Safety layer with DPDP Act 2023, IT Rules 2021, GDPR rights, and Dodo Payments Merchant of Record disclosures.',
      },
    ],
  },

  terms: {
    id: 'terms',
    path: '/terms',
    title: 'Terms of Service',
    pageTitle: `Terms of Service · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Terms of Service for ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}), covering eligibility, AI output disclaimers, content ownership, Dodo Payments billing, and Indian governing law.`,
    kicker: 'LEGAL AGREEMENT // TERMS OF SERVICE',
    subtitle: `Please read these Terms of Service carefully before using ${LEGAL_CONFIG.TRADE_NAME}. By accessing or using our services, you agree to be bound by these Terms.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `You must be at least ${LEGAL_CONFIG.MIN_AGE} years old to access or use ${LEGAL_CONFIG.TRADE_NAME}.`,
      `You own the prompts and study documents you upload, and you may use Kinich's AI outputs for personal, educational, and commercial work. We do not use your content to train AI models.`,
      `AI outputs can be inaccurate or incomplete. Never rely on Kinich as a substitute for qualified medical, legal, financial, tax, or mental-health professionals.`,
      `Paid subscriptions (${LEGAL_CONFIG.PRICE}) are billed by Dodo Payments as Merchant of Record, renew automatically until cancelled, and are covered by our Refund Policy (/refund).`,
      `Uploading photos of real people, government IDs (Aadhaar, PAN), payment card numbers, or explicit material is strictly prohibited (/acceptable-use).`,
    ],
    sections: [
      {
        id: 'who-we-are',
        number: '01',
        title: 'Who We Are & Acceptance of Terms',
        paragraphs: [
          `These Terms of Service ("Terms") form a legally binding contract between you ("User", "you") and ${LEGAL_CONFIG.OPERATOR_NAME}, the creator and operator of the "${LEGAL_CONFIG.TRADE_NAME}" SaaS platform (${LEGAL_CONFIG.ADDRESS}) ("${LEGAL_CONFIG.TRADE_NAME}", "we", "us", or "our").`,
          `These Terms govern your access to and use of ${LEGAL_CONFIG.LIVE_SITE_URL} and all associated web applications, APIs, AI search tools, Deep Research reports, YouTube Study workspaces, PDF study tools, and related services (collectively, the "Service"). By creating an account, checking the consent box, or using the Service in guest mode, you accept and agree to these Terms, our Privacy Policy (/privacy), our Acceptable Use Policy (/acceptable-use), and our Refund & Cancellation Policy (/refund).`,
        ],
      },
      {
        id: 'eligibility',
        number: '02',
        title: 'Eligibility & Minimum Age',
        paragraphs: [
          `You must be at least ${LEGAL_CONFIG.MIN_AGE} years of age to create an account and access or use ${LEGAL_CONFIG.TRADE_NAME}. The Service is strictly intended for adults and is not directed to individuals under ${LEGAL_CONFIG.MIN_AGE}. By checking the consent box ("I confirm I am at least 18 years old and agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy.") or using the Service, you represent and warrant that you are at least ${LEGAL_CONFIG.MIN_AGE} years old.`,
        ],
      },
      {
        id: 'accounts-and-guest-mode',
        number: '03',
        title: 'User Accounts & Guest Mode',
        paragraphs: [
          `You may access limited features of ${LEGAL_CONFIG.TRADE_NAME} in Guest Mode or register for a full account using an email address and password or Google OAuth sign-in (powered by Firebase Authentication).`,
        ],
        bullets: [
          `Account Accuracy & Security: You must provide accurate registration information and keep your login credentials confidential. You are responsible for all activity occurring under your account.`,
          `One Person Per Account: Accounts are for individual use and may not be shared among multiple people or used to pool usage quotas.`,
          `Guest Mode Limitations: Guest Mode stores conversation threads, bookmarks, and preferences locally in your browser and is subject to stricter daily usage limits and a ${LEGAL_CONFIG.GUEST_RETENTION_DAYS}-day inactivity expiration. Clearing your browser data or switching devices will permanently erase unsynced Guest Mode data.`,
        ],
      },
      {
        id: 'service-description',
        number: '04',
        title: 'Description of the Service & Beta Features',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} provides an integrated AI workspace featuring: (a) AI Search with live web citations; (b) autonomous Deep Research reports; (c) a YouTube Study workspace that retrieves public video transcripts and generates summaries, quizzes, flashcards, lesson plans, and audio syntheses; (d) PDF and document study extraction; (e) Knowledge Vault note curation and Kinich Discover community pages; and (f) daily study streaks, badges, and referral rewards.`,
          `Certain features may be labeled as "Preview", "Beta", or "Experimental". Beta features are provided as-is, may change or be discontinued at any time, and may exhibit higher latency or error rates.`,
        ],
      },
      {
        id: 'ai-output-disclaimer',
        number: '05',
        title: 'AI Output Disclaimer & Professional Advice Warning',
        callout: {
          title: 'IMPORTANT: AI OUTPUTS MAY BE INACCURATE OR INCOMPLETE',
          body: `${LEGAL_CONFIG.TRADE_NAME} uses probabilistic large language models that can generate plausible-sounding but factually incorrect, outdated, or biased responses ("hallucinations"). Always independently verify critical facts, citations, equations, and code before relying on them.`,
        },
        bullets: [
          `No Medical, Legal, Financial, or Mental-Health Advice: Outputs generated by ${LEGAL_CONFIG.TRADE_NAME} are for informational and educational purposes only. They do not constitute medical diagnosis or treatment, legal counsel, financial or investment advice, tax advice, or psychotherapy.`,
          `Citations & Web Sources: While ${LEGAL_CONFIG.TRADE_NAME} grounds search answers in live web sources, arXiv papers, and YouTube transcripts, the AI summary may misinterpret a source, omit context, or cite a third-party page that itself contains errors.`,
          `Academic & Exam Disclaimer: Study guides, flashcards, quizzes, and lesson plans generated in the YouTube Study or PDF Studio workspaces are supplementary study aids. ${LEGAL_CONFIG.OPERATOR_NAME} makes no representation or guarantee regarding academic grades, entrance exam scores, or certification outcomes.`,
        ],
      },
      {
        id: 'your-content',
        number: '06',
        title: 'Your Content, Ownership & AI Processing License',
        paragraphs: [
          `As between you and ${LEGAL_CONFIG.OPERATOR_NAME}, you retain all ownership rights in the text prompts, questions, PDFs, study notes, and files you submit to the Service ("User Input"), and, to the fullest extent permitted by applicable law, you own the specific syntheses, study guides, and outputs generated for you in response to your User Input ("Output"). Due to the nature of machine learning, similar or identical Outputs may be generated for other users asking similar questions.`,
          `Limited License to Operate the Service: By submitting User Input, you grant ${LEGAL_CONFIG.OPERATOR_NAME} a worldwide, non-exclusive, royalty-free license to host, cache, transmit, display, and process your User Input solely as necessary to provide, secure, and maintain the Service for you (and, only when you explicitly click "Share" or "Publish to Discover", to display that shared thread or page to others).`,
          `No Foundation Model Training: Kinich does not use your data to train its own models. Third-party AI providers process prompts under their respective API terms, which do not use paid API traffic for model training; free-tier or fallback endpoints may be subject to the provider's standard terms.`,
        ],
      },
      {
        id: 'acceptable-use',
        number: '07',
        title: 'Acceptable Use & Content Restrictions',
        paragraphs: [
          `Your use of ${LEGAL_CONFIG.TRADE_NAME} is subject to our Acceptable Use and Content Policy (/acceptable-use), which is incorporated into these Terms by reference. In particular, you agree that you will NOT:`,
        ],
        bullets: [
          `Upload or generate Child Sexual Abuse Material (CSAM), child sexual exploitation and abuse (CSAE), or any content sexualizing minors;`,
          `Upload or generate 18+/NSFW sexually explicit content, nudity, or non-consensual intimate imagery ("deepfakes");`,
          `Upload photographs, selfies, portraits, or videos of real identifiable people (${LEGAL_CONFIG.TRADE_NAME} is strictly for documents, notes, diagrams, and educational media);`,
          `Upload government identification documents (such as Indian Aadhaar numbers, PAN cards, passports, driver's licences) or payment card numbers, bank statements, UPI PINs, or API keys;`,
          `Use the Service to cheat on live, proctored, or closed-book academic examinations, or to conduct automated scraping, rate-limit evasion, or referral farming.`,
        ],
      },
      {
        id: 'third-party-services',
        number: '08',
        title: 'Third-Party Content & Services',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} integrates with third-party platforms and APIs, including YouTube (for embedded video playback and public transcripts), web search engines, arXiv, PubMed, GitHub, Google Firebase (for authentication and cloud sync), third-party AI model providers, and Dodo Payments (for subscription billing).`,
          `Third-party web links, YouTube videos, social posts, and academic papers remain the intellectual property of their respective owners and are governed by their own terms of service (including the YouTube Terms of Service at https://www.youtube.com/t/terms and Google Privacy Policy at https://policies.google.com/privacy). ${LEGAL_CONFIG.OPERATOR_NAME} does not endorse and is not responsible for the accuracy, legality, or availability of external websites or third-party content.`,
        ],
      },
      {
        id: 'intellectual-property',
        number: '09',
        title: 'Kinich Intellectual Property',
        paragraphs: [
          `The ${LEGAL_CONFIG.TRADE_NAME} name, logo, user interface design, software code, system architecture, curated Discover templates, badge artwork, and documentation are owned by ${LEGAL_CONFIG.OPERATOR_NAME} and protected by Indian and international copyright, trademark, and intellectual property laws. Except for your User Input and Outputs, these Terms do not grant you any right, title, or interest in the Service.`,
        ],
      },
      {
        id: 'paid-plans-and-billing',
        number: '10',
        title: 'Paid Plans, Billing, Merchant of Record & Usage Limits',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} offers a Free Tier along with optional paid subscriptions: Spark (${LEGAL_CONFIG.SPARK_PRICE_MONTHLY} or ${LEGAL_CONFIG.SPARK_PRICE_ANNUAL}) and Fire (${LEGAL_CONFIG.FIRE_PRICE_MONTHLY} or ${LEGAL_CONFIG.FIRE_PRICE_ANNUAL}).`,
        ],
        bullets: [
          `Merchant of Record: All subscription payments are processed by Dodo Payments ("Dodo"), which acts as our authorized Merchant of Record and reseller. Your bank or card statement will display Dodo Payments (or Dodo*Kinich).`,
          `Automatic Renewal & Cancellation: Subscriptions renew automatically at the end of each monthly or annual billing cycle unless you cancel beforehand via Settings → Plans & Pricing or through your Dodo Payments billing portal link. After cancellation, your paid features remain active until the end of the current paid period, after which your account reverts to the Free Tier.`,
          `Taxes & Price Changes: Displayed prices may be subject to applicable GST, VAT, or sales tax calculated by Dodo Payments at checkout based on your billing location. We will give at least 30 days' advance notice via email before any price increase takes effect on an existing subscription.`,
          `Usage Quotas & Fair Use: Each plan includes daily usage allowances (resetting at 00:00 UTC) for prompts, file uploads, web searches, Deep Research reports, and Study sessions. Even on high-limit or "unlimited" tiers, automated scripting, account sharing, proxy resale, or abusive burst traffic that degrades service stability is prohibited and may be rate-limited.`,
          `Refunds: Refund eligibility is governed by our Refund and Cancellation Policy (/refund), which includes a ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day full refund window on your first subscription purchase.`,
        ],
      },
      {
        id: 'referral-program',
        number: '11',
        title: 'Referral Program Rules',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} operates a promotional referral program allowing users to share a unique invite link (?ref=zp_...) to earn bonus search allowances or promotional Pro access days when genuinely new users sign up.`,
        ],
        bullets: [
          `Eligibility: A referral is valid only when a bona fide new user who has never previously held a ${LEGAL_CONFIG.TRADE_NAME} account registers and verifies their account using your link.`,
          `No Self-Referrals or Farming: Creating multiple accounts, using disposable/alias emails, deploying bots, or running paid search ads on "${LEGAL_CONFIG.TRADE_NAME}" brand keywords to claim referral rewards is strictly prohibited.`,
          `No Cash Value & Revocation: Referral rewards are promotional service credits with no cash or monetary value, are non-transferable, and may be revoked or modified at any time if our anti-abuse engine detects fraudulent or duplicate activity.`,
        ],
      },
      {
        id: 'suspension-and-termination',
        number: '12',
        title: 'Suspension & Termination',
        paragraphs: [
          `You may stop using ${LEGAL_CONFIG.TRADE_NAME} and delete your account at any time via Settings → Profile & Account. We reserve the right to warn, restrict features, suspend, or permanently terminate your account if we reasonably determine that you have violated these Terms or our Acceptable Use Policy (/acceptable-use), engaged in payment fraud or unauthorized chargebacks, or posed a security or legal risk to the Service or any third party.`,
          `Where reasonable and lawful, we will notify you of the reason for suspension and provide instructions on how to appeal via ${LEGAL_CONFIG.SUPPORT_EMAIL}. Zero-tolerance violations (such as CSAM, non-consensual intimate imagery, or severe security attacks) result in immediate permanent termination without prior notice.`,
        ],
      },
      {
        id: 'disclaimers',
        number: '13',
        title: 'Disclaimers ("As Is" and "As Available")',
        paragraphs: [
          `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE AND ALL AI OUTPUTS ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, QUIET ENJOYMENT, AND NON-INFRINGEMENT. ${LEGAL_CONFIG.OPERATOR_NAME} DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE, OR THAT ANY AI OUTPUT WILL BE FACTUALLY CORRECT OR SUITABLE FOR YOUR INTENDED USE.`,
        ],
      },
      {
        id: 'limitation-of-liability',
        number: '14',
        title: 'Limitation of Liability',
        paragraphs: [
          `TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER ${LEGAL_CONFIG.OPERATOR_NAME} NOR ITS OFFICERS, EMPLOYEES, SUPPLIERS, OR LICENSORS SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR ACADEMIC/BUSINESS OPPORTUNITY ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE OR RELIANCE ON ANY AI OUTPUT.`,
          `IN ALL EVENTS, OUR AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT YOU PAID FOR THE SERVICE IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ${LEGAL_CONFIG.LIABILITY_CAP_INR} (OR ${LEGAL_CONFIG.LIABILITY_CAP_USD} FOR USERS OUTSIDE INDIA). NOTHING IN THESE TERMS EXCLUDES OR LIMITS LIABILITY THAT CANNOT BE EXCLUDED UNDER APPLICABLE LAW.`,
        ],
      },
      {
        id: 'indemnity',
        number: '15',
        title: 'Indemnification',
        paragraphs: [
          `To the extent permitted by law, you agree to defend, indemnify, and hold harmless ${LEGAL_CONFIG.OPERATOR_NAME} and its affiliates from and against any third-party claims, liabilities, damages, losses, and reasonable legal fees arising out of or connected with: (a) your User Input or uploads; (b) your breach of these Terms or the Acceptable Use Policy; or (c) your violation of any applicable law or third-party intellectual property or privacy right.`,
        ],
      },
      {
        id: 'copyright-complaints',
        number: '16',
        title: 'Copyright & Intellectual Property Complaints',
        paragraphs: [
          `We respect intellectual property rights and respond to notices of alleged copyright infringement in accordance with the Indian Copyright Act, 1957, Rule 3(1)(d) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the U.S. Digital Millennium Copyright Act (DMCA).`,
          `If you believe that any public content on ${LEGAL_CONFIG.TRADE_NAME} (such as a published Kinich Discover page or shared thread) infringes your copyright, please send a written takedown notice to ${LEGAL_CONFIG.SUPPORT_EMAIL} containing: (1) identification of the copyrighted work; (2) the exact URL on ${LEGAL_CONFIG.LIVE_SITE_URL} of the allegedly infringing material; (3) your name, postal address, telephone number, and email address; (4) a good-faith statement that the disputed use is not authorized by the copyright owner, its agent, or the law; and (5) a statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner's behalf.`,
        ],
      },
      {
        id: 'governing-law',
        number: '17',
        title: 'Governing Law, Informal Resolution & Dispute Jurisdiction',
        paragraphs: [
          `Informal Resolution First: Before initiating any formal legal proceeding, you agree to contact us at ${LEGAL_CONFIG.SUPPORT_EMAIL} with a written description of your dispute and allow at least ${LEGAL_CONFIG.INFORMAL_RESOLUTION_DAYS} days for good-faith informal resolution.`,
          `Governing Law & Venue: These Terms and any dispute arising out of or in connection with the Service shall be governed by and construed in accordance with the laws of the Republic of India, without regard to conflict-of-law principles. Subject to any mandatory consumer protection rights in your country of residence, the courts located in ${LEGAL_CONFIG.GOVERNING_COURTS} shall have exclusive jurisdiction over all disputes.`,
        ],
      },
      {
        id: 'changes-to-terms',
        number: '18',
        title: 'Changes to These Terms',
        paragraphs: [
          `We may update these Terms from time to time to reflect new features, regulatory requirements, or security practices. When we make material changes, we will update the "Last Updated" date at the top of this page, increment the policy version (${LEGAL_CONFIG.CONSENT_VERSION}), and notify signed-in users via an in-app re-consent prompt or email before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.`,
        ],
      },
      {
        id: 'contact',
        number: '19',
        title: 'Contact Information & Grievance Officer SLA',
        paragraphs: [
          `Questions about these Terms may be directed to ${LEGAL_CONFIG.OPERATOR_NAME} at ${LEGAL_CONFIG.SUPPORT_EMAIL}, or through our Contact & Support page (/contact). Formal grievances submitted to our Grievance Officer (${LEGAL_CONFIG.GRIEVANCE_EMAIL}) are acknowledged within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours and resolved within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} days.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Comprehensive Terms of Service covering all 19 sections, Dodo Payments Merchant of Record terms, DPDP age rules, AI disclaimers, and Hyderabad jurisdiction.',
      },
    ],
  },

  privacy: {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    pageTitle: `Privacy Policy · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Privacy Policy for ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}), compliant with India's DPDP Act 2023, IT Rules 2021, and GDPR data protection standards.`,
    kicker: 'DATA PROTECTION // PRIVACY POLICY',
    subtitle: `How ${LEGAL_CONFIG.OPERATOR_NAME} collects, processes, protects, and respects your personal data under India's Digital Personal Data Protection Act 2023 (DPDP Act) and international privacy standards.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `${LEGAL_CONFIG.OPERATOR_NAME} (${LEGAL_CONFIG.ADDRESS}) is the Data Fiduciary / Data Controller for ${LEGAL_CONFIG.TRADE_NAME}.`,
      `We collect only what is needed to run the app: your account profile (Email/Google), your chat threads, study uploads, Knowledge Vault notes, and daily usage quota counters.`,
      `We NEVER sell your personal data, and we NEVER use your prompts, chats, or uploaded documents to train foundation AI models.`,
      `Payments are handled by Dodo Payments as Merchant of Record — ${LEGAL_CONFIG.TRADE_NAME} never sees or stores your credit/debit card numbers or UPI PINs.`,
      `You can export all of your data (JSON) or permanently delete your account at any time in Settings → Profile & Account, or by emailing ${LEGAL_CONFIG.PRIVACY_EMAIL}.`,
    ],
    sections: [
      {
        id: 'data-fiduciary',
        number: '01',
        title: 'Who Is the Data Fiduciary / Controller',
        paragraphs: [
          `For the purposes of India's Digital Personal Data Protection Act, 2023 ("DPDP Act"), the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and, where applicable, the EU/UK General Data Protection Regulation ("GDPR"), the Data Fiduciary / Data Controller is:`,
        ],
        bullets: [
          `Legal Entity / Operator: ${LEGAL_CONFIG.OPERATOR_NAME} (trading as "${LEGAL_CONFIG.TRADE_NAME}")`,
          `Address: ${LEGAL_CONFIG.ADDRESS}`,
          `Privacy & Data Rights Email: ${LEGAL_CONFIG.PRIVACY_EMAIL}`,
          `Grievance Officer: ${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME} (${LEGAL_CONFIG.GRIEVANCE_EMAIL})`,
        ],
      },
      {
        id: 'data-we-collect',
        number: '02',
        title: 'Personal Data We Collect',
        paragraphs: [
          `We collect the following categories of personal data depending on how you use ${LEGAL_CONFIG.TRADE_NAME}:`,
        ],
        bullets: [
          `Account Data: When you sign in with Google OAuth or Email/Password via Firebase Authentication, we collect your email address, display name, profile avatar URL (if provided by Google), authentication UID, account creation timestamp, and your policy consent record (version and timestamp).`,
          `Workspace & User Content Data: Search queries, chat prompts, conversation history threads, uploaded PDFs/images/study files, YouTube video URLs submitted for study, generated summaries/quizzes/flashcards, saved bookmarks, and Knowledge Vault items.`,
          `Usage, Streak & Referral Data: Daily feature usage counters (prompts, uploads, searches, Deep Research runs, Study sessions), study streak dates, unlocked achievement badges, your unique referral code (zp_...), and inbound referral attribution.`,
          `Device & Technical Telemetry: IP address (used for security rate-limiting and abuse prevention), browser type, operating system, language preference, timezone offset, crash/error logs, and anonymized error diagnostics and performance metrics (via Sentry) to catch crash reports and improve system reliability.`,
          `Payment & Billing Metadata: When you subscribe to Spark or Fire, checkout is processed directly by Dodo Payments as Merchant of Record. We receive only your subscription plan status, billing cycle, transaction reference ID, and tax country. We never collect, process, or store your full credit/debit card number, CVV, bank account details, or UPI PIN.`,
          `Cookies & Local Storage: Authentication tokens, theme/UI preferences, local thread cache, and a 30-day referral attribution cookie/key (?ref). See our Cookie Notice (/cookies) for the complete key-by-key table.`,
        ],
      },
      {
        id: 'how-we-use-data',
        number: '03',
        title: 'How We Use Your Data & Legal Basis',
        paragraphs: [
          `We process your personal data strictly for the purposes and under the lawful bases set out below:`,
        ],
        table: {
          headers: ['Purpose of Processing', 'Data Categories Involved', 'DPDP Act 2023 / GDPR Legal Basis'],
          rows: [
            [
              'Providing AI search, Deep Research, YouTube Study, and PDF study tools',
              'Workspace & Content Data, Account Data',
              'Performance of a contract (Terms of Service) & your affirmative consent',
            ],
            [
              'Cross-device workspace sync, Knowledge Vault, streaks, and referral rewards',
              'Account Data, Workspace Data, Usage & Referral Data',
              'Performance of a contract & affirmative consent',
            ],
            [
              'Enforcing plan quotas, subscription entitlements, and processing refunds',
              'Account Data, Usage Data, Payment Metadata',
              'Performance of a contract & legal obligation (tax/accounting)',
            ],
            [
              'Content safety moderation (blocking CSAM, faces, IDs, NSFW) and rate-limiting abuse',
              'Uploaded files (inspected transiently), Technical/IP Data, Safety event metadata',
              'Legitimate uses / Legitimate interests (platform safety) & legal compliance (IT Rules 2021)',
            ],
            [
              'Responding to support tickets, privacy requests, and Grievance Officer complaints',
              'Account Data, Contact Form submissions',
              'Legal obligation (DPDP Act & IT Rules 2021) & performance of a contract',
            ],
            [
              'Opt-in location awareness for local news, weather & regional search',
              'Coarse City-Level Location Data (or Edge IP header fallback)',
              'Affirmative consent & performance of a contract',
            ],
          ],
        },
      },
      {
        id: 'location-data',
        number: '04',
        title: 'Location Data Handling & Privacy Controls',
        paragraphs: [
          `Default IP Approximate Location: By default, Kinich reads coarse, city-level IP geolocation headers provided by edge proxy servers (x-vercel-ip-city, x-vercel-ip-country-region, x-vercel-ip-country, x-vercel-ip-timezone) to refine weather forecasts and local search results without requiring browser location permissions. Raw IP addresses are never logged or stored.`,
          `Optional Precise Location (Off by Default): Precise location is strictly optional and off by default. It can be toggled in Settings or triggered on demand via the "Use precise location" button. Exact GPS coordinates (latitude and longitude) are sent to server-side reverse-geocoding (LocationIQ) only for that specific request and are immediately discarded. Only city-level location is retained.`,
          `Saved Home City Memory: Signed-in users may save a home city in their profile settings ("I live in..."). When active, your saved home city takes priority over IP location when IP data looks inaccurate (e.g., while connected to a VPN). You can edit or clear your home city at any time in Settings.`,
          `No Third-Party Account Data: Kinich does NOT access, read, or parse Gmail, Google Workspace, or any third-party email/contact data for location inference or tracking under any circumstances.`,
        ],
      },
      {
        id: 'ai-processing',
        number: '05',
        title: 'AI Model Processing & Third-Party Inference Providers',
        paragraphs: [
          `When you submit a prompt, document, or study request, ${LEGAL_CONFIG.TRADE_NAME} sends the relevant prompt context to third-party AI model providers (such as Google Gemini API, DeepSeek, and OpenRouter/TokenHarbor/MoonMath/IteraCompute API gateways) to generate your answer, quiz, or summary. When you use the YouTube Study workspace, we retrieve publicly available captions/transcripts for the video ID you specify.`,
          `Kinich does not use your data to train its own models. Third-party AI providers process prompts under their respective API terms, which do not use paid API traffic for model training; free-tier or fallback endpoints may be subject to the provider's standard terms. Each provider processes inference requests under its published API privacy terms (linked in Section 5 below).`,
        ],
      },
      {
        id: 'data-sharing',
        number: '05',
        title: 'How We Share Data & Subprocessors ("We Do Not Sell Your Data")',
        paragraphs: [
          `We do NOT sell, rent, or trade your personal data to data brokers, advertisers, or any third party. We share data only with the infrastructure and API subprocessors required to deliver the Service:`,
        ],
        table: {
          headers: ['Subprocessor / Service', 'Role & Purpose', 'Data Shared', 'Location & Privacy Policy'],
          rows: THIRD_PARTY_SERVICES_AUDIT.map((s) => [
            s.name,
            `${s.category}: ${s.purpose}`,
            s.dataShared,
            `${s.location} (${s.privacyPolicyUrl})`,
          ]),
        },
      },
      {
        id: 'international-transfers',
        number: '06',
        title: 'International Data Transfers',
        paragraphs: [
          `${LEGAL_CONFIG.OPERATOR_NAME} is based in India, while several of our cloud infrastructure and AI inference subprocessors (including Google Cloud/Firebase, Vercel, and LLM API gateways) process data on servers located in the United States and other jurisdictions outside India.`,
          `We transfer personal data internationally in compliance with Section 16 of the DPDP Act 2023 (to jurisdictions not restricted by the Central Government of India) and, for EEA/UK users, pursuant to Standard Contractual Clauses (SCCs) and industry-standard encryption in transit (TLS 1.2/1.3) and at rest.`,
        ],
      },
      {
        id: 'data-retention',
        number: '07',
        title: 'Data Retention Schedule',
        paragraphs: [
          `We retain personal data only for as long as necessary to fulfill the purposes described in this policy or comply with statutory obligations:`,
        ],
        table: {
          headers: ['Data Category', 'Retention Period', 'Deletion / Expiration Behavior'],
          rows: [
            [
              'Registered Account Profile & Consent Records',
              `Active account duration + up to ${LEGAL_CONFIG.ACCOUNT_DELETION_PURGE_DAYS} days after account deletion request`,
              'Permanently purged from Firebase Authentication and Cloud Firestore within 30 days of deletion.',
            ],
            [
              'Chat Threads, Bookmarks & Knowledge Vault Items',
              'Until deleted by you or until your account is deleted',
              'Individual threads or your entire history can be deleted immediately from the sidebar or Settings.',
            ],
            [
              'Blocked Uploads (Safety Rejections)',
              '0 seconds (discarded immediately in memory)',
              'Rejected files containing faces, NSFW content, or government IDs are never stored; only a non-content timestamp counter is logged for 24 hours.',
            ],
            [
              'Guest Mode Local Workspace Data',
              `Up to ${LEGAL_CONFIG.GUEST_RETENTION_DAYS} days of inactivity (or until you click "Clear Guest Data")`,
              'Stored in your browser localStorage and cleared on demand or after 30 days.',
            ],
            [
              'Server Security, Rate-Limit & Moderation Logs',
              `${LEGAL_CONFIG.SERVER_LOG_RETENTION_DAYS} days`,
              'Automatically rotated and purged after 90 days.',
            ],
            [
              'Subscription Billing & Tax Records',
              '7–8 years as required by Indian & international tax laws',
              'Maintained by Dodo Payments as Merchant of Record for statutory tax and audit compliance.',
            ],
          ],
        },
      },
      {
        id: 'security',
        number: '08',
        title: 'Security Practices & Safeguards',
        paragraphs: [
          `We implement reasonable security practices and procedures as mandated under Section 8(5) of the DPDP Act 2023 and the IT Act 2000, including:`,
        ],
        bullets: [
          `Encryption in transit via HTTPS/TLS across all web and API connections, and encryption at rest in Google Cloud Firestore.`,
          `Cryptographic Firebase authentication token verification on protected routes and per-user access control rules.`,
          `Upload moderation guidelines and filters to prevent the ingestion and storage of sensitive government IDs (Aadhaar/PAN) and payment card numbers.`,
          `In the event of a personal data security incident affecting your rights, we will notify affected users and regulatory authorities as required by applicable law.`,
        ],
      },
      {
        id: 'your-rights',
        number: '09',
        title: 'Your Data Protection Rights (DPDP Act 2023 & GDPR)',
        paragraphs: [
          `Under the Indian Digital Personal Data Protection Act, 2023 (Sections 11–14) and international privacy laws (GDPR Articles 15–22), you have the following rights:`,
        ],
        bullets: [
          `Right to Access & Summary of Data: Request a summary of the personal data we process about you and the subprocessors involved in providing the service.`,
          `Right to Correction & Updating: Update your profile and display preferences in Settings, or request correction of inaccurate personal data.`,
          `Right to Erasure / Account Deletion: Permanently delete your chat history or request account deletion at any time in Settings → Profile & Account, or by emailing ${LEGAL_CONFIG.PRIVACY_EMAIL}.`,
          `Right to Data Portability / Export: Request an export of your personal account data by emailing ${LEGAL_CONFIG.PRIVACY_EMAIL}.`,
          `Right to Withdraw Consent: Withdraw your consent to data processing at any time by deleting your account or clearing your local cookies/storage.`,
          `Right to Nominate (India DPDP Act Section 14): You have the right to nominate another individual who may exercise your data principal rights in the event of your death or incapacity by emailing ${LEGAL_CONFIG.PRIVACY_EMAIL} with the subject line "DPDP Nomination".`,
          `Right to Grievance Redressal & Regulatory Complaint: You may contact our Grievance Officer (${LEGAL_CONFIG.GRIEVANCE_EMAIL}) for redressal. If your grievance is not resolved within the statutory period, you have the right to lodge a complaint with the Data Protection Board of India.`,
        ],
        callout: {
          title: 'How to Exercise Your Rights',
          body: `You can clear chat data and manage your account in Settings, or email ${LEGAL_CONFIG.PRIVACY_EMAIL}. We verify requests via your registered account email and respond within ${LEGAL_CONFIG.DATA_RIGHTS_RESPONSE_DAYS} days.`,
        },
      },
      {
        id: 'children',
        number: '10',
        title: 'Age Requirement & Children’s Privacy',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} is strictly intended for individuals ${LEGAL_CONFIG.MIN_AGE} years of age and older. At registration and before first guest use, users must affirm: "I confirm I am at least 18 years old and agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy." We do not knowingly collect or process personal data from individuals under ${LEGAL_CONFIG.MIN_AGE}. If you believe an individual under 18 has registered an account, please contact ${LEGAL_CONFIG.PRIVACY_EMAIL} and we will promptly delete the account and associated records.`,
        ],
      },
      {
        id: 'grievance-officer',
        number: '11',
        title: 'Grievance Officer (DPDP Act 2023 & IT Rules 2021)',
        paragraphs: [
          `In compliance with Section 13 of the DPDP Act 2023 and Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the contact details of our Grievance Officer are:`,
        ],
        bullets: [
          `Name: ${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME}`,
          `Email: ${LEGAL_CONFIG.GRIEVANCE_EMAIL}`,
          `Operational Location: ${LEGAL_CONFIG.OPERATOR_NAME}, ${LEGAL_CONFIG.ADDRESS}`,
          `Response SLA: We endeavor to acknowledge grievances within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours and resolve them within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} days from receipt.`,
        ],
      },
      {
        id: 'cookies-summary',
        number: '12',
        title: 'Cookies & Local Storage Summary',
        paragraphs: [
          `We use strictly necessary and functional browser storage (localStorage and a 30-day referral cookie) to keep you signed in, remember your Dark/Light theme, cache your chat threads, and attribute referral invites. We do not use third-party advertising or cross-site tracking cookies. For the complete list of keys and controls, please read our dedicated Cookie Notice (/cookies).`,
        ],
      },
      {
        id: 'changes-to-privacy',
        number: '13',
        title: 'Changes to This Privacy Policy',
        paragraphs: [
          `We may revise this Privacy Policy periodically. Any material updates will be accompanied by a new version number, an updated "Effective Date" at the top of this page, and an in-app notice or re-consent prompt.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Initial publication with full DPDP Act 2023, IT Rules 2021, GDPR rights, retention schedule, and subprocessor audit table.',
      },
    ],
  },

  refund: {
    id: 'refund',
    path: '/refund',
    title: 'Refund and Cancellation Policy',
    pageTitle: `Refund & Cancellation Policy · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Refund and Cancellation Policy for ${LEGAL_CONFIG.TRADE_NAME} subscriptions (${LEGAL_CONFIG.PRICE}), processed by Dodo Payments as Merchant of Record with a ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day first-purchase refund window.`,
    kicker: 'BILLING & MERCHANT OF RECORD // REFUND POLICY',
    subtitle: `Clear, fair cancellation and refund terms for ${LEGAL_CONFIG.TRADE_NAME} subscriptions, processed in partnership with Dodo Payments as our Merchant of Record.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `Dodo Payments is our Merchant of Record and handles all subscription billing, taxes (GST/VAT), invoices, and refunds.`,
      `First-time subscribers get a ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day full refund guarantee — no questions asked, once per customer.`,
      `You can cancel your subscription anytime in two clicks from Settings → Plans & Pricing or via your Dodo Payments customer portal link.`,
      `Renewal charges are refundable within ${LEGAL_CONFIG.RENEWAL_REFUND_HOURS} hours if no paid usage occurred in the new billing cycle.`,
      `Duplicate charges, billing errors, or service outages lasting more than ${LEGAL_CONFIG.OUTAGE_REFUND_HOURS} hours are always refunded in full.`,
    ],
    sections: [
      {
        id: 'merchant-of-record',
        number: '01',
        title: 'Merchant of Record Statement (Dodo Payments)',
        paragraphs: [
          `All paid subscriptions on ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}), operated by ${LEGAL_CONFIG.OPERATOR_NAME}, are sold and processed by our authorized Merchant of Record, Dodo Payments ("Dodo"). When you purchase a subscription, your payment transaction is processed by Dodo Payments, which handles payment collection, applicable tax/GST/VAT compliance, invoicing, and refund disbursements back to your original payment method.`,
        ],
      },
      {
        id: 'plans-and-pricing',
        number: '02',
        title: 'Plans, Pricing & Billing Cycles',
        paragraphs: [
          `${LEGAL_CONFIG.TRADE_NAME} offers the following subscription tiers (all prices in USD, with local currency conversion and applicable taxes shown at checkout). Subscriptions are billed in advance on a recurring monthly or annual cycle and renew automatically until cancelled:`,
        ],
        table: {
          headers: ['Plan Tier', 'Monthly Price', 'Annual Price (Save 20%)', 'Included Allowances & Features'],
          rows: [
            [
              'Free Tier',
              '$0 / month',
              '$0 / year',
              '5 daily chats, 3 file uploads/day, 5 web searches/day, 3 Deep Research runs/day, 5 Study sessions/day on default and free vision models.',
            ],
            [
              'Spark Plan',
              LEGAL_CONFIG.SPARK_PRICE_MONTHLY,
              LEGAL_CONFIG.SPARK_PRICE_ANNUAL,
              '10x daily limits (1,500 daily prompts, 250 file uploads/day, 750 web searches/day, 100 Deep Research runs/day, 200 Study sessions/day) + Spark tier models.',
            ],
            [
              'Fire Plan',
              LEGAL_CONFIG.FIRE_PRICE_MONTHLY,
              LEGAL_CONFIG.FIRE_PRICE_ANNUAL,
              'Unlimited daily prompts, file uploads, web searches, Deep Research reports, and Study sessions (subject to anti-abuse fair use) + all frontier flagship models.',
            ],
          ],
        },
      },
      {
        id: 'cancellation',
        number: '03',
        title: 'How to Cancel Your Subscription',
        paragraphs: [
          `You may cancel your recurring subscription at any time without penalty using any of the following methods:`,
        ],
        bullets: [
          `In-App Self-Service: Open ${LEGAL_CONFIG.TRADE_NAME} → Settings → Plans & Pricing and click "Manage / Cancel Subscription".`,
          `Dodo Payments Customer Portal: Click the "Manage Subscription" link in any email receipt or invoice sent to you by Dodo Payments.`,
          `By Email: Email ${LEGAL_CONFIG.SUPPORT_EMAIL} from your registered account email address with the subject "Cancel Subscription".`,
        ],
        callout: {
          title: 'What Happens After You Cancel',
          body: `Cancellation stops all future automatic renewals immediately. You will continue to enjoy full access to your paid Spark or Fire plan features until the end of your current paid billing period, after which your account automatically transitions back to the Free Tier.`,
        },
      },
      {
        id: 'refund-eligibility',
        number: '04',
        title: 'Refund Policy & Eligibility Windows',
        paragraphs: [
          `We stand behind the quality of ${LEGAL_CONFIG.TRADE_NAME} and offer transparent refund terms:`,
        ],
        bullets: [
          `${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-Day First-Purchase Satisfaction Guarantee: If you are a first-time subscriber to Spark or Fire and are not satisfied for any reason, you may request a 100% full refund within ${LEGAL_CONFIG.REFUND_WINDOW_DAYS} calendar days of your initial purchase — no questions asked (limited to one first-purchase refund per customer).`,
          `Unintended Renewal Refunds (${LEGAL_CONFIG.RENEWAL_REFUND_HOURS}-Hour Window): If you forgot to cancel before a monthly or annual renewal date, you may request a full refund of the renewal charge within ${LEGAL_CONFIG.RENEWAL_REFUND_HOURS} hours of the renewal charge, provided your account has not consumed paid plan usage during the new billing cycle.`,
          `Billing Errors, Duplicate Charges & Extended Outages: We always provide a 100% full or pro-rata refund in the event of an accidental duplicate charge, a verifiable technical billing error, or a continuous service-wide outage of ${LEGAL_CONFIG.TRADE_NAME} exceeding ${LEGAL_CONFIG.OUTAGE_REFUND_HOURS} consecutive hours.`,
        ],
      },
      {
        id: 'non-refundable-items',
        number: '05',
        title: 'Non-Refundable Situations',
        paragraphs: [
          `Refunds are not provided in the following circumstances:`,
        ],
        bullets: [
          `Requests submitted after the ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day window on an initial purchase or after the ${LEGAL_CONFIG.RENEWAL_REFUND_HOURS}-hour window on a renewal (except for billing errors or extended outages);`,
          `Partial-month or unused-time prorated refunds when you cancel mid-cycle after the refund window has closed (instead, your access continues through the end of the billing period);`,
          `Accounts suspended or terminated for violations of our Acceptable Use Policy (/acceptable-use) or Terms of Service (/terms);`,
          `Repeat refund requests from a customer who has already received a first-purchase refund on a prior subscription.`,
        ],
      },
      {
        id: 'how-to-request-refund',
        number: '06',
        title: 'How to Request a Refund & Processing Timeline',
        paragraphs: [
          `To request a refund, please email ${LEGAL_CONFIG.SUPPORT_EMAIL} (or submit a ticket on our Contact & Support page at /contact with the topic "Billing") and include: (1) the email address associated with your ${LEGAL_CONFIG.TRADE_NAME} account, and (2) your Dodo Payments invoice or receipt number.`,
          `We review and respond to all refund requests within 2 business days. Once approved, Dodo Payments processes the refund immediately back to your original payment method (credit/debit card, UPI, or wallet). Depending on your bank or card issuer, funds typically appear on your statement within 5 to 10 business days.`,
        ],
      },
      {
        id: 'chargebacks',
        number: '07',
        title: 'Chargebacks & Payment Disputes',
        paragraphs: [
          `If you see an unfamiliar or unexpected charge from Dodo Payments / ${LEGAL_CONFIG.TRADE_NAME}, please contact ${LEGAL_CONFIG.SUPPORT_EMAIL} first before filing a credit card chargeback with your bank. We resolve billing issues and eligible refunds rapidly (usually within 24–48 hours), whereas bank chargebacks take weeks and automatically trigger a temporary security freeze on the associated ${LEGAL_CONFIG.TRADE_NAME} account while the dispute is investigated.`,
        ],
      },
      {
        id: 'free-tier-and-guest-mode',
        number: '08',
        title: 'Free Tier & Guest Mode',
        paragraphs: [
          `The ${LEGAL_CONFIG.TRADE_NAME} Free Tier and Guest Mode are completely free ($0) and never require a credit card or payment method. You will never be charged unless you explicitly select a paid plan and complete checkout through Dodo Payments.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: `Published Dodo Payments Merchant of Record refund and cancellation policy with ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day first-purchase refund window.`,
      },
    ],
  },

  'acceptable-use': {
    id: 'acceptable-use',
    path: '/acceptable-use',
    title: 'Acceptable Use and Content Policy',
    pageTitle: `Acceptable Use Policy · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Acceptable Use and Content Safety Policy for ${LEGAL_CONFIG.TRADE_NAME}, prohibiting CSAM, NSFW content, photos of identifiable people, sensitive government IDs, and academic dishonesty.`,
    kicker: 'TRUST & SAFETY // ACCEPTABLE USE POLICY',
    subtitle: `Mandatory content, upload, and behavioral standards keeping ${LEGAL_CONFIG.TRADE_NAME} safe for research, study, and academic inquiry.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `Do NOT upload photos of real people, selfies, or portraits. ${LEGAL_CONFIG.TRADE_NAME} is strictly for documents, notes, diagrams, and educational media.`,
      `Zero tolerance for CSAM/CSAE, 18+/NSFW sexually explicit material, or non-consensual intimate imagery — violations result in an immediate permanent ban and reporting to authorities.`,
      `Do NOT upload sensitive personal IDs (Aadhaar, PAN, passport, driver's licence) or financial credentials (card numbers, UPI PINs, API keys). Such uploads are strictly prohibited and subject to removal.`,
      `Do NOT use ${LEGAL_CONFIG.TRADE_NAME} for self-harm, illegal weapons/drugs, malware, harassment, or live proctored exam cheating.`,
      `Anyone can report unsafe outputs or shared pages using the in-app Report button or by emailing ${LEGAL_CONFIG.ABUSE_EMAIL}.`,
    ],
    sections: [
      {
        id: 'category-a-prohibited-uploads',
        number: '01',
        title: 'Category A — Zero-Tolerance Prohibited Uploads & Visual Content',
        callout: {
          title: 'STUDY MATERIAL ONLY — DO NOT UPLOAD PHOTOS OF PEOPLE',
          body: `Do not upload images of people. ${LEGAL_CONFIG.TRADE_NAME} is for documents, notes, study material, diagrams, code screenshots, and educational media. Uploads containing human faces, selfies, or explicit content are prohibited.`,
        },
        bullets: [
          `Child Sexual Abuse Material (CSAM) & Child Sexual Exploitation and Abuse (CSAE): Absolute zero tolerance. We will report apparent CSAM to NCMEC and/or Indian cybercrime authorities (cybercrime.gov.in) as required by applicable law and terminate the offending account.`,
          `18+ / NSFW / Sexually Explicit Content & Nudity: You may not upload, prompt for, or generate pornography, sexually explicit text or imagery, nudity, or erotic roleplay.`,
          `Non-Consensual Intimate Imagery (NCII) & Deepfakes: You may not upload intimate images of any person or attempt to generate synthetic, undressed, or manipulated likenesses of any person.`,
          `Photos, Selfies & Videos of Real Identifiable People: You may not upload photographs, portraits, selfies, or videos depicting real identifiable living individuals (whether yourself, classmates, teachers, or public figures). Allowed uploads are limited to textbook pages, lecture slides, handwritten notes, scientific diagrams, charts, equations, and software UI screenshots.`,
          `Facial Recognition & Biometric Identification: You may not use ${LEGAL_CONFIG.TRADE_NAME} to identify, profile, track, or infer biometric attributes of any individual from an image or video.`,
        ],
      },
      {
        id: 'category-b-sensitive-data',
        number: '02',
        title: 'Category B — Prohibited Sensitive Personal & Financial Data',
        paragraphs: [
          `To protect your privacy and comply with Indian and international data minimization laws, you must NOT upload documents, images, or prompts containing sensitive government identifiers or financial secrets:`,
          `Prohibited Data Policy: Users are strictly forbidden from uploading Indian government IDs (such as Aadhaar or PAN), payment card credentials, or bank details. Matching or flagged uploads are discarded and subject to immediate removal.`,
        ],
        bullets: [
          `Indian & International Government IDs: Aadhaar cards or 12-digit Aadhaar numbers, Permanent Account Number (PAN) cards, passports, voter ID (EPIC) cards, driver's licences, or Social Security numbers.`,
          `Financial & Authentication Credentials: Credit or debit card numbers, CVV codes, bank account statements, UPI PINs, net-banking passwords, one-time passwords (OTPs), private cryptographic keys, or production API keys/tokens.`,
          `Confidential Third-Party Medical Records: Unredacted patient health records, hospital discharge summaries, or diagnostic reports identifying a third party.`,
        ],
      },
      {
        id: 'category-c-prohibited-uses',
        number: '03',
        title: 'Category C — Prohibited Uses & Harmful Conduct',
        paragraphs: [
          `You may not use ${LEGAL_CONFIG.TRADE_NAME}'s AI search, Deep Research, or study tools for any of the following activities:`,
        ],
        bullets: [
          `Illegal Acts, Weapons & Dangerous Materials: Facilitating illegal acts, cyberattacks, financial fraud, illicit drugs, or instructions for manufacturing weapons, explosives, or chemical/biological agents.`,
          `Suicide or Self-Harm Encouragement: Generating instructions, encouragement, or methods for suicide or self-harm. (If you or someone you know is in distress, call India's 24/7 Tele-MANAS helpline at ${LEGAL_CONFIG.TELE_MANAS_HELPLINE} or find international support at ${LEGAL_CONFIG.INTERNATIONAL_HELPLINE_URL}.)`,
          `Harassment, Bullying, Hate Speech & Doxxing: Generating targeted harassment, defamation, caste/religious/racial hate speech, or publishing private personal contact details ("doxxing").`,
          `Violent Extremism & Terrorism: Promoting terrorist organizations, violent extremism, or threats against India's sovereignty, integrity, or public order (IT Act Section 69A / IT Rules 2021).`,
          `Malware, Phishing & Exploitation: Writing ransomware, spyware, credential-harvesting phishing templates, or exploiting software vulnerabilities without authorization.`,
          `Academic Dishonesty on Live Proctored Exams: Using ${LEGAL_CONFIG.TRADE_NAME} to obtain real-time answers during a live, closed-book, or proctored academic examination or standardized test.`,
          `Unverified High-Stakes Decisions: Using AI outputs to make automated or unreviewed medical, clinical, legal, lending, employment, or financial decisions.`,
          `Deceptive Impersonation & Coordinated Misinformation: Generating fabricated news articles, fake official notices, or impersonating real individuals or institutions without clear disclosure.`,
          `Copyright Infringement: Uploading or publishing full-text pirated textbooks or copyrighted works that you do not have the legal right to use.`,
          `Platform Abuse, Scraping & Referral Farming: Automated scraping of ${LEGAL_CONFIG.TRADE_NAME} endpoints, bypassing rate limits, creating fake accounts to farm referral rewards, or reselling ${LEGAL_CONFIG.TRADE_NAME} API access.`,
        ],
      },
      {
        id: 'category-d-enforcement',
        number: '04',
        title: 'Category D — Enforcement Ladder & Appeals',
        paragraphs: [
          `When safety checks or user reports identify a policy violation, we apply a proportionate enforcement approach:`,
          `Right to Appeal: If you believe an upload rejection or account action was applied in error, you may email ${LEGAL_CONFIG.SUPPORT_EMAIL} with the subject "Safety Appeal" and your account email. Appeals are evaluated in good faith within 7 business days.`,
        ],
        table: {
          headers: ['Step', 'Action Taken', 'Triggering Condition'],
          rows: [
            [
              'Step 1: Real-Time Refusal / Upload Block',
              'The prompt or file upload is blocked immediately with a policy explanation; the file is discarded and never stored.',
              'Single non-severe prompt refusal or accidental upload of a selfie / ID document.',
            ],
            [
              'Step 2: Feature Restriction (24 Hours)',
              'File uploads or public sharing are temporarily restricted for 24 hours and the account is flagged for review.',
              '3 or more blocked uploads or repeated prompt moderation triggers within a 24-hour window.',
            ],
            [
              'Step 3: Content Removal & Account Suspension',
              'Publicly shared artifacts are removed and the account is temporarily suspended pending investigation (appeals reviewed within 7 business days).',
              'Repeated Category B/C violations, referral abuse, or valid copyright/abuse reports.',
            ],
            [
              'Step 4: Immediate Permanent Ban & Reporting',
              'Permanent account termination without refund and, where applicable, reporting to NCMEC / law enforcement.',
              'Any Category A CSAM/CSAE violation, non-consensual intimate imagery, or severe platform attack.',
            ],
          ],
        },
      },
      {
        id: 'category-e-reporting',
        number: '05',
        title: 'Category E — How to Report Violations or Unsafe Content',
        paragraphs: [
          `Every AI response, YouTube Study set, Deep Research report, and Kinich Discover page includes a built-in "Report" button allowing you to flag inaccurate, harmful, or infringing content directly to our Trust & Safety queue. You may also report abuse, safety issues, or illegal content at any time via ${LEGAL_CONFIG.ABUSE_EMAIL} or through our Contact & Support page (/contact). Formal grievances are acknowledged within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours and resolved within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} days.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Initial publication with Categories A–E, upload guard rules for faces/Aadhaar/PAN/cards, enforcement ladder, and Tele-MANAS crisis resources.',
      },
    ],
  },

  cookies: {
    id: 'cookies',
    path: '/cookies',
    title: 'Cookie & LocalStorage Notice',
    pageTitle: `Cookie Notice · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Cookie and browser LocalStorage Notice for ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL}), documenting every storage key, purpose, and retention duration.`,
    kicker: 'TRANSPARENCY // COOKIE & STORAGE NOTICE',
    subtitle: `Complete inventory of browser cookies and localStorage keys used by ${LEGAL_CONFIG.TRADE_NAME}, why we use them, and how you can manage or clear them.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `${LEGAL_CONFIG.TRADE_NAME} uses zero third-party advertising cookies and zero cross-site tracking pixels.`,
      `We use strictly necessary browser storage to keep you signed in (Firebase Auth), remember your policy consent, and enforce daily plan quotas.`,
      `We use functional localStorage to save your Dark/Light theme, sidebar state, and local chat history for fast loading.`,
      `When you visit via a friend's invite link (?ref=zp_...), we store a referral attribution key/cookie for up to ${LEGAL_CONFIG.REFERRAL_ATTRIBUTION_DAYS} days so you both receive your signup reward.`,
      `You can choose "Essential Only" or "Accept All" in our Cookie Banner at any time, or clear all guest storage in one click from Settings.`,
    ],
    sections: [
      {
        id: 'how-we-use-storage',
        number: '01',
        title: 'How Kinich Uses Cookies & Browser Storage',
        paragraphs: [
          `Modern web applications use browser cookies and HTML5 localStorage to maintain session state across page reloads. At ${LEGAL_CONFIG.TRADE_NAME}, we minimize browser storage to what is genuinely needed to authenticate your account, remember your interface preferences, cache your study workspace locally, and honor referral links.`,
          `We do NOT use third-party advertising networks, behavioral retargeting cookies, or cross-site tracking pixels.`,
        ],
      },
      {
        id: 'storage-inventory',
        number: '02',
        title: 'Complete Cookie & LocalStorage Key Inventory',
        paragraphs: [
          `Every cookie and localStorage key set by ${LEGAL_CONFIG.TRADE_NAME} is documented in the table below:`,
        ],
        table: {
          headers: ['Key / Cookie Name', 'Type', 'Category', 'Purpose', 'Duration'],
          rows: STORAGE_KEYS_AUDIT.map((k) => [
            k.key,
            k.storageType,
            k.category,
            k.purpose,
            k.duration,
          ]),
        },
      },
      {
        id: 'managing-cookies',
        number: '03',
        title: 'How to Manage, Reject, or Clear Storage',
        paragraphs: [
          `You have full control over browser storage on ${LEGAL_CONFIG.TRADE_NAME}:`,
        ],
        bullets: [
          `In-App Cookie & Storage Banner: Use the "Essential Only" or "Manage" controls in our storage banner (or reopen it from the footer) to restrict non-essential functional/attribution storage.`,
          `Clear Guest Data Button: If you are using ${LEGAL_CONFIG.TRADE_NAME} in Guest Mode, go to Settings → Profile & Account and click "Clear Guest Data" to immediately wipe all local chat threads, bookmarks, and preferences from your browser.`,
          `Browser Settings: You can block or delete cookies and site data at any time through your browser settings (Chrome, Safari, Firefox, Edge, or Brave). Note that blocking Strictly Necessary storage will prevent Firebase Authentication from keeping you signed in.`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Documented complete inventory of cookies and localStorage keys used across authentication, workspace state, and 30-day referral attribution.',
      },
    ],
  },

  contact: {
    id: 'contact',
    path: '/contact',
    title: 'Contact and Support',
    pageTitle: `Contact & Support · ${LEGAL_CONFIG.TRADE_NAME}`,
    metaDescription: `Contact ${LEGAL_CONFIG.OPERATOR_NAME} for ${LEGAL_CONFIG.TRADE_NAME} billing support, Dodo Payments refund requests, DPDP Act privacy inquiries, Grievance Officer escalation, and abuse reporting.`,
    kicker: 'CUSTOMER CARE & STATUTORY COMPLIANCE // CONTACT US',
    subtitle: `Direct support channels, statutory Grievance Officer contact details, and an interactive ticket form for billing, technical bugs, privacy rights, and safety reports.`,
    effectiveDate: LEGAL_CONFIG.EFFECTIVE_DATE,
    lastUpdated: LEGAL_CONFIG.EFFECTIVE_DATE,
    version: LEGAL_CONFIG.CONSENT_VERSION,
    shortVersionBullets: [
      `General & Technical Support: ${LEGAL_CONFIG.SUPPORT_EMAIL} — target response within 24–48 hours.`,
      `Billing & Refunds: Processed with Dodo Payments (Merchant of Record) via Settings → Plans & Pricing or ${LEGAL_CONFIG.SUPPORT_EMAIL}.`,
      `Privacy & Data Requests (DPDP Act / GDPR): ${LEGAL_CONFIG.PRIVACY_EMAIL} — processed within ${LEGAL_CONFIG.DATA_RIGHTS_RESPONSE_DAYS} days.`,
      `Statutory Grievance Officer (India): ${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME} (${LEGAL_CONFIG.GRIEVANCE_EMAIL}) — acknowledged within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours, resolved within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} days.`,
      `Operator & Location: ${LEGAL_CONFIG.OPERATOR_NAME}, ${LEGAL_CONFIG.ADDRESS}.`,
    ],
    sections: [
      {
        id: 'direct-channels',
        number: '01',
        title: 'Direct Support, Billing & Compliance Channels',
        table: {
          headers: ['Department / Channel', 'Contact Email / Portal', 'Response SLA & Scope'],
          rows: [
            [
              'General & Technical Support',
              LEGAL_CONFIG.SUPPORT_EMAIL,
              'Within 24–48 hours. Bug reports, account help, and general inquiries.',
            ],
            [
              'Billing, Subscriptions & Refunds (Dodo Payments)',
              `${LEGAL_CONFIG.SUPPORT_EMAIL} or Dodo Customer Portal`,
              `Within 24–48 hours. Subscription cancellation, invoice requests, and ${LEGAL_CONFIG.REFUND_WINDOW_DAYS}-day first-purchase refund claims.`,
            ],
            [
              'Privacy & Data Principal Rights (DPDP / GDPR)',
              LEGAL_CONFIG.PRIVACY_EMAIL,
              `Within ${LEGAL_CONFIG.DATA_RIGHTS_RESPONSE_DAYS} days. Data access, correction, export, account deletion, and DPDP nominations.`,
            ],
            [
              'Statutory Grievance Officer (India DPDP Act & IT Rules)',
              `${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME} <${LEGAL_CONFIG.GRIEVANCE_EMAIL}>`,
              `Acknowledged within ${LEGAL_CONFIG.GRIEVANCE_ACK_HOURS} hours; resolved within ${LEGAL_CONFIG.GRIEVANCE_RESOLUTION_DAYS} calendar days.`,
            ],
            [
              'Trust & Safety / Abuse Reporting',
              LEGAL_CONFIG.ABUSE_EMAIL,
              'Reviewed within 24–48 hours. Report unsafe AI outputs, prohibited uploads, or abusive shared links.',
            ],
            [
              'Copyright & DMCA / IT Rules Takedowns',
              LEGAL_CONFIG.COPYRIGHT_EMAIL,
              'Acknowledged within 24–48 hours in accordance with applicable laws.',
            ],
          ],
        },
      },
      {
        id: 'operator-address',
        number: '02',
        title: 'Operator Identity & Contact Details',
        bullets: [
          `Operator: ${LEGAL_CONFIG.OPERATOR_NAME}`,
          `SaaS: ${LEGAL_CONFIG.TRADE_NAME} (${LEGAL_CONFIG.LIVE_SITE_URL})`,
          `Operational Location: ${LEGAL_CONFIG.ADDRESS}`,
          `Grievance Officer: ${LEGAL_CONFIG.GRIEVANCE_OFFICER_NAME} (${LEGAL_CONFIG.GRIEVANCE_EMAIL})`,
        ],
      },
    ],
    versionHistory: [
      {
        version: LEGAL_CONFIG.CONSENT_VERSION,
        date: LEGAL_CONFIG.EFFECTIVE_DATE,
        changes: 'Published complete support directory, Grievance Officer SLA, and rate-limited support ticket form.',
      },
    ],
  },
};
