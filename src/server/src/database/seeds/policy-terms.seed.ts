/**
 * Policy Terms Seed Data
 *
 * Contains seed data for policy terms:
 * - TPO (Third Party Only) Motor Insurance Policy
 */

import { PolicyTermsType } from '../../modules/policy/entities/policy-terms.entity.js';

/**
 * TPO Policy Terms Content (English)
 */
export const TPO_CONTENT_EN = `
<h1>Third Party Only (TPO) Motor Insurance Policy</h1>

<h2>1. POLICY COVERAGE</h2>
<p>This policy provides coverage for third-party liability arising from the use of your motorcycle (bodaboda) on public roads in Kenya.</p>

<h3>1.1 What is Covered</h3>
<ul>
  <li>Legal liability for death or bodily injury to third parties</li>
  <li>Legal liability for damage to third-party property</li>
  <li>Legal costs and expenses incurred with the insurer's consent</li>
</ul>

<h3>1.2 Coverage Limits</h3>
<ul>
  <li>Bodily Injury: Unlimited</li>
  <li>Property Damage: Up to KES 3,000,000 per occurrence</li>
</ul>

<h2>2. EXCLUSIONS</h2>
<p>This policy does NOT cover:</p>
<ul>
  <li>Damage to your own motorcycle</li>
  <li>Your own bodily injury</li>
  <li>Theft of your motorcycle</li>
  <li>Loss of use or consequential losses</li>
  <li>Contractual liabilities</li>
  <li>Racing, speed testing, or competitions</li>
  <li>Use under the influence of alcohol or drugs</li>
  <li>Unlicensed or unauthorized drivers</li>
</ul>

<h2>3. PREMIUM PAYMENT</h2>
<p>Premium is payable as follows:</p>
<ul>
  <li>Initial Deposit: KES 1,048 (provides 1-month coverage)</li>
  <li>Daily Payments: KES 87 for 30 days (provides 11-month coverage)</li>
  <li>Total Annual Premium: KES 3,658</li>
</ul>

<h2>4. POLICY PERIOD</h2>
<p>This policy is valid for the period shown in your policy schedule. Coverage begins at 00:01 hours on the commencement date.</p>

<h2>5. CLAIMS PROCEDURE</h2>
<p>In the event of an accident:</p>
<ol>
  <li>Report to the nearest police station within 24 hours</li>
  <li>Notify BodaInsure via the app or USSD within 48 hours</li>
  <li>Do not admit liability or make any settlement</li>
  <li>Provide all requested documentation</li>
</ol>

<h2>6. CANCELLATION</h2>
<p>You may cancel this policy within 30 days of commencement for a full refund (Free Look Period). After 30 days, refunds are calculated on a pro-rata basis.</p>

<h2>7. GOVERNING LAW</h2>
<p>This policy is governed by the laws of Kenya and subject to the jurisdiction of Kenyan courts.</p>

<h2>8. REGULATORY COMPLIANCE</h2>
<p>This policy complies with the Insurance Act (Cap 487) and regulations by the Insurance Regulatory Authority (IRA) of Kenya.</p>
`.trim();

/**
 * TPO Policy Terms Content (Swahili)
 */
export const TPO_CONTENT_SW = `
<h1>Bima ya Mtu wa Tatu Pekee (TPO) kwa Pikipiki</h1>

<h2>1. ULINZI WA BIMA</h2>
<p>Bima hii inalinda dhidi ya madai ya kisheria kutoka kwa watu wengine yatokanayo na matumizi ya pikipiki yako (bodaboda) katika barabara za umma nchini Kenya.</p>

<h3>1.1 Kinacholindwa</h3>
<ul>
  <li>Dhima ya kisheria kwa kifo au majeraha ya watu wengine</li>
  <li>Dhima ya kisheria kwa uharibifu wa mali ya watu wengine</li>
  <li>Gharama za kisheria zinazokubaliwa na bima</li>
</ul>

<h2>2. YASIYOLINDWA</h2>
<p>Bima hii HAILINDI:</p>
<ul>
  <li>Uharibifu wa pikipiki yako</li>
  <li>Majeraha yako mwenyewe</li>
  <li>Wizi wa pikipiki yako</li>
</ul>

<h2>3. MALIPO YA BIMA</h2>
<ul>
  <li>Amana ya Awali: KES 1,048 (ulinzi wa mwezi 1)</li>
  <li>Malipo ya Kila Siku: KES 87 kwa siku 30 (ulinzi wa miezi 11)</li>
  <li>Jumla ya Bima ya Mwaka: KES 3,658</li>
</ul>
`.trim();

/**
 * TPO Policy Terms Summary (English)
 */
export const TPO_SUMMARY_EN =
  'TPO insurance covering third-party liability for bodaboda riders. Covers injury to others and damage to their property. Does not cover your own motorcycle or injuries.';

/**
 * TPO Policy Terms Summary (Swahili)
 */
export const TPO_SUMMARY_SW =
  'Bima ya TPO inalinda dhidi ya madai ya watu wengine. Inalinda majeraha ya wengine na uharibifu wa mali yao. Hailindi pikipiki yako au majeraha yako.';

/**
 * Key terms list (English)
 */
export const KEY_TERMS_EN = [
  'Third-party liability coverage',
  'Unlimited bodily injury cover',
  'Property damage up to KES 3M',
  '30-day free look period',
  'Daily payment option available',
];

/**
 * Key terms list (Swahili)
 */
export const KEY_TERMS_SW = [
  'Ulinzi wa dhima ya mtu wa tatu',
  'Ulinzi usio na kikomo kwa majeraha',
  'Uharibifu wa mali hadi KES 3M',
  'Kipindi cha siku 30 cha kutazama bure',
  'Chaguo la malipo ya kila siku',
];

/**
 * Policy inclusions
 */
export const INCLUSIONS = [
  'Third-party bodily injury liability',
  'Third-party property damage liability',
  'Legal defense costs',
  'Emergency assistance hotline',
];

/**
 * Policy exclusions
 */
export const EXCLUSIONS = [
  'Own damage to motorcycle',
  'Personal injury to policyholder',
  'Theft or loss of motorcycle',
  'Racing or speed testing',
  'Driving under influence',
  'Unlicensed drivers',
];

/**
 * TPO Policy Terms complete seed data
 */
export const TPO_POLICY_TERMS_SEED = {
  version: '1.0',
  type: PolicyTermsType.TPO,
  title: 'Third Party Only (TPO) Motor Insurance Policy',
  content: TPO_CONTENT_EN,
  summary: TPO_SUMMARY_EN,
  contentSw: TPO_CONTENT_SW,
  summarySw: TPO_SUMMARY_SW,
  keyTerms: KEY_TERMS_EN,
  keyTermsSw: KEY_TERMS_SW,
  inclusions: INCLUSIONS,
  exclusions: EXCLUSIONS,
  freeLookDays: 30,
  underwriterName: 'Definite Assurance Company Ltd',
  cancellationPolicy:
    'Full refund within 30-day free look period. Pro-rata refund thereafter minus administrative fee of KES 500.',
  claimsProcess:
    '1. Report to police within 24 hours. 2. Notify BodaInsure within 48 hours. 3. Submit required documents. 4. Claim assessment within 14 days.',
  isActive: true,
} as const;
