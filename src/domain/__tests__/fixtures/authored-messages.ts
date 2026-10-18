/**
 * Messages written for the detector corpus (D21): the shapes of what users
 * report as wrongly read, kept as text because nothing in them is anyone's.
 *
 * Unlike `messages.ts`, these state the truth even where the reader does not
 * meet it yet — that is what the corpus measures. They reach it as skeletons,
 * made fresh each run, so a word added to the skeleton's vocabulary reaches
 * them too.
 */

import type { CorpusRow } from '@/domain/txn-detect/model/corpus';

export type AuthoredMessage = Pick<CorpusRow, 'id' | 'kind' | 'group' | 'note'> & {
  body: string;
  sender?: string;
  packageName?: string;
};

export const AUTHORED_MESSAGES: AuthoredMessage[] = [
  {
    id: 'au:loan-preapproved-credited',
    sender: 'VM-HDFCBK-P',
    kind: 'promo',
    note: 'pre-approved loan offer that says credited',
    body: 'Congratulations! A pre-approved Personal Loan of Rs 2,00,000 can be credited to your HDFC Bank account instantly. Apply now: https://hdfc.bank/pl1',
  },
  {
    id: 'au:loan-approved-will-credit',
    sender: 'AD-IDFCFB-S',
    kind: 'upcoming',
    note: 'loan approved, credit is future',
    body: 'Your loan of Rs.50,000 is approved and will be credited to your account within 24 hours. -IDFC FIRST Bank',
  },
  {
    id: 'au:emi-conversion-offer',
    sender: 'JD-ICICIT-P',
    kind: 'promo',
    note: 'EMI conversion offer naming a past purchase',
    body: 'Convert your purchase of INR 15,000.00 at AMAZON on ICICI Bank Card XX9012 into easy EMIs at 13% p.a. Reply EMI to 5676766',
  },
  {
    id: 'au:flat-off-paid',
    sender: 'VK-SBIUPI-P',
    kind: 'promo',
    note: 'offer that mentions paid',
    body: 'Get flat Rs 100 off on your next bill payment! Paid Rs 500 or more this month? Pay via BHIM SBI Pay now. T&C apply',
  },
  {
    id: 'au:reward-points-credited',
    sender: 'AX-AXISBK-P',
    kind: 'promo',
    note: 'reward points worth an amount',
    body: 'Reward points worth Rs 250 have been credited to your Axis Bank Credit Card XX4455. Redeem before 31-Oct-26 at https://axis.bank/rp',
  },
  {
    id: 'au:cashback-voucher-received',
    sender: 'JD-PAYTMB-P',
    kind: 'promo',
    note: 'voucher, not money back',
    body: 'You have received a cashback voucher worth Rs.100 on your last payment. Use it before 30-Sep-26. -Paytm',
  },
  {
    id: 'au:lucky-draw-won',
    sender: 'VM-KOTAKB-P',
    kind: 'promo',
    note: 'prize offer that says credited',
    body: 'You have won Rs 5,000 in the Kotak lucky draw! Amount will be credited after KYC. Claim now https://kotak.bank/win',
  },
  {
    id: 'au:limit-increased',
    sender: 'JD-ICICIT-S',
    kind: 'balance',
    note: 'credit limit notice',
    body: 'Your ICICI Bank Credit Card XX9012 limit has been increased to Rs 3,00,000. Enjoy higher spends!',
  },
  {
    id: 'au:friend-sent-chat',
    packageName: 'com.truecaller',
    kind: 'unknown',
    group: 'must_not_count',
    note: 'a person, not a bank, saying they sent money',
    body: 'Bro I sent Rs 500 to your account yesterday, check once',
  },
  {
    id: 'au:shop-cashback-promo',
    sender: 'VM-HDFCBK-P',
    kind: 'promo',
    note: 'plain bank promotion',
    body: 'HDFC Bank: Shop now and get 10% cashback up to Rs 1,500 on spends of Rs 5,000 using your Credit Card. T&C apply',
  },
  {
    id: 'au:premium-due',
    sender: 'VM-LICIND-S',
    kind: 'reminder',
    note: 'insurance premium reminder',
    body: 'Premium of Rs 12,500 for policy 123456789 is due on 15-Oct-26. Pay now to avoid lapse.',
  },
  {
    id: 'au:bill-generated',
    sender: 'VM-BESCOM-S',
    kind: 'reminder',
    note: 'utility bill generated',
    body: 'Bill of Rs 1,240.00 generated for CA 1234567. Pay by 20-Oct-26 to avoid late fee.',
  },
  {
    id: 'au:declined-card',
    sender: 'JD-HDFCBK-T',
    kind: 'failed',
    note: 'declined card spend',
    body: 'Txn of Rs 2,999.00 on HDFC Bank Card XX1234 at FLIPKART was declined due to insufficient funds.',
  },
  {
    id: 'au:collect-request',
    sender: 'JD-SBIUPI-S',
    kind: 'reminder',
    note: 'UPI collect request',
    body: 'Arun has requested Rs 300 from you via UPI. Approve in your UPI app if you know the sender. -SBI',
  },
  {
    id: 'au:spend-with-promo-tail',
    sender: 'JD-HDFCBK-T',
    kind: 'transaction',
    note: 'a real spend with an offer after it must stay a spend',
    body: 'Rs.1,250.00 spent on HDFC Bank Card XX1234 at SWIGGY on 05-10-26. Get flat 10% off on your next order with code SAVE10.',
  },
  {
    id: 'au:credit-with-future-tail',
    sender: 'JD-SBIINB-S',
    kind: 'transaction',
    note: 'a real credit that mentions a later credit must stay a credit',
    body: 'Rs 5,000.00 credited to A/c XX4321 on 05-10-26 by NEFT from ACME LTD. Interest will be credited quarterly. -SBI',
  },
  {
    id: 'au:preapproved-loan-emi-debited',
    sender: 'JD-HDFCBK-S',
    kind: 'transaction',
    note: 'a real EMI debit that opens with "pre-approved" must stay a payment',
    body: 'Your pre-approved loan EMI of Rs 3,000.00 has been debited from A/c XX1234 on 05-10-26. -HDFC Bank',
  },
];
