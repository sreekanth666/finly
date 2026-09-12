/**
 * The message corpus the transaction detector is held to.
 *
 * The first ten are real alerts the owner received, with names, VPAs and
 * reference numbers changed. Everything after them is a representative format
 * for another bank, card, wallet or UPI app, written from the shapes those
 * senders are known to use. When a real message is misread, it belongs here,
 * masked, with the expectation it should have met — that is how the detector
 * gets better without anyone's messages ever leaving the phone.
 *
 * `receivedAt` is built in local time, like the app's own clock, so the suite
 * passes under every zone `pnpm test:tz` runs.
 */

import type { MessageInput } from '@/domain/txn-detect';

export type MessageExpectation = {
  kind?: string;
  direction?: 'debit' | 'credit' | null;
  amountMinor?: number | null;
  /** Every amount the chip picker should offer, best first. */
  amountCandidates?: number[];
  currency?: string | null;
  /** Local 'YYYY-MM-DD' of `occurredAt`. */
  dayKey?: string;
  /** Local 'HH:mm' of `occurredAt`, when the message carried a time. */
  time?: string;
  dateConfidence?: string;
  instrumentType?: string | null;
  instrumentTail?: string | null;
  issuer?: string | null;
  reference?: string | null;
  channel?: string | null;
  counterparty?: string | null;
  item?: string;
  confidence?: 'high' | 'medium' | 'low';
  reasons?: string[];
};

export type MessageFixture = {
  name: string;
  input: MessageInput;
  ownerName?: string;
  expected: MessageExpectation;
};

const at = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

const HDFC_SENT = (amount: string, to: string, on: string, ref: string) =>
  [
    `Sent Rs.${amount}`,
    'From HDFC Bank A/C *6630',
    `To ${to}`,
    `On ${on}`,
    `Ref ${ref}`,
    'Not You?',
    'Call 18002586161/SMS BLOCK UPI to 7308080808',
  ].join('\n');

/* -------------------------------------------------------------------------- */
/* The owner's own messages, masked                                             */
/* -------------------------------------------------------------------------- */

export const OWNER_MESSAGES: MessageFixture[] = [
  {
    name: 'ICICI UPI debit, merchant after a semicolon',
    input: {
      body: 'ICICI Bank Acct XX316 debited for Rs 720.00 on 02-Sep-26; KSBC FL017040 P credited. UPI:624568811772. Call 18002662 for dispute. SMS BLOCK 316 to 9215676766.',
      sender: 'JD-ICICIT-S',
      receivedAt: at(2026, 9, 2, 19, 14),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 72000,
      currency: 'INR',
      dayKey: '2026-09-02',
      instrumentType: 'account',
      instrumentTail: '316',
      issuer: 'ICICI Bank',
      reference: '624568811772',
      channel: 'upi',
      counterparty: 'KSBC FL017040 P',
      item: 'KSBC P',
      confidence: 'high',
    },
  },
  {
    name: 'ICICI UPI debit, received the same day',
    input: {
      body: 'ICICI Bank Acct XX316 debited for Rs 3800.00 on 21-Aug-26; KSBC FL017040 P credited. UPI:623337960212. Call 18002662 for dispute. SMS BLOCK 316 to 9215676766.',
      sender: 'AX-ICICIT-S',
      receivedAt: at(2026, 8, 21, 20, 2),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 380000,
      dayKey: '2026-08-21',
      time: '20:02',
      dateConfidence: 'day_only',
      reference: '623337960212',
      confidence: 'high',
    },
  },
  {
    name: 'ICICI reversal credit',
    input: {
      body: 'Dear Customer, your ICICI Bank Account XXX316 has been credited with Rs 5000.00 on 02-Aug-26 as reversal of transaction with UPI: 658093611400.',
      sender: 'JD-ICICIT-S',
      receivedAt: at(2026, 8, 2, 11, 0),
    },
    expected: {
      kind: 'refund',
      direction: 'credit',
      amountMinor: 500000,
      dayKey: '2026-08-02',
      instrumentTail: '316',
      reference: '658093611400',
      counterparty: null,
      item: 'Reversal',
      confidence: 'medium',
    },
  },
  {
    name: 'HDFC UPI credit from a VPA',
    input: {
      body: 'Credit Alert!\nRs.500.00 credited to HDFC Bank A/c XX6630 on 10-09-26 from VPA arjun.k@okaxis (UPI 625325710634)',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 10, 9, 30),
    },
    expected: {
      kind: 'transaction',
      direction: 'credit',
      amountMinor: 50000,
      dayKey: '2026-09-10',
      instrumentTail: '6630',
      issuer: 'HDFC Bank',
      reference: '625325710634',
      channel: 'upi',
      counterparty: 'arjun.k@okaxis',
      item: 'Arjun K',
      confidence: 'high',
    },
  },
  {
    name: 'HDFC multi-line UPI send to a person',
    input: {
      body: HDFC_SENT('500.00', 'MEERA  K S', '10/09/26', '129385983254'),
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 10, 9, 45),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 50000,
      dayKey: '2026-09-10',
      instrumentType: 'account',
      instrumentTail: '6630',
      reference: '129385983254',
      channel: 'upi',
      counterparty: 'MEERA K S',
      item: 'Meera K S',
      confidence: 'high',
    },
  },
  {
    name: 'HDFC multi-line UPI send to an app',
    input: {
      body: HDFC_SENT('218.00', 'Super Money', '05/09/26', '624820340289'),
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 5, 16, 20),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 21800,
      dayKey: '2026-09-05',
      counterparty: 'Super Money',
      item: 'Super Money',
      confidence: 'high',
    },
  },
  {
    name: 'SBI UPI debit with no currency mark, to the BSE clearing house',
    input: {
      body: 'Dear UPI user A/C X8783 debited by 1000.00 on date 10Sep26 trf to Indian Clearing Refno 110645528048 If not u? call-1800111109 for other services-18001234-SBI',
      sender: 'BZ-SBIUPI-S',
      receivedAt: at(2026, 9, 10, 10, 5),
    },
    expected: {
      kind: 'transfer',
      direction: 'debit',
      amountMinor: 100000,
      currency: 'INR',
      dayKey: '2026-09-10',
      instrumentTail: '8783',
      issuer: 'SBI',
      reference: '110645528048',
      channel: 'upi',
      counterparty: 'Indian Clearing',
    },
  },
  {
    name: 'SBI UPI debit, second instalment',
    input: {
      body: 'Dear UPI user A/C X8783 debited by 1000.00 on date 10Sep26 trf to Indian Clearing Refno 110645523607 If not u? call-1800111109 for other services-18001234-SBI',
      sender: 'BZ-SBIUPI-S',
      receivedAt: at(2026, 9, 10, 10, 6),
    },
    expected: { kind: 'transfer', amountMinor: 100000, reference: '110645523607' },
  },
  {
    name: 'Utkarsh SuperCard debit with no year and a 12-hour time',
    input: {
      body: 'Dear Arjun, your SuperCard 0194 debited for INR 700.00 on 02 Sep 07:12 PM for UPI - 661184090154. To dispute call 18003097986 - Utkarsh SFBL',
      sender: 'JM-UTKSFB-S',
      receivedAt: at(2026, 9, 2, 19, 13),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 70000,
      dayKey: '2026-09-02',
      time: '19:12',
      dateConfidence: 'exact',
      instrumentType: 'card',
      instrumentTail: '0194',
      issuer: 'Utkarsh SFB',
      reference: '661184090154',
      channel: 'upi',
      counterparty: null,
      item: 'UPI payment',
      confidence: 'medium',
    },
  },
  {
    name: 'Utkarsh statement with two amounts',
    input: {
      body: 'Your Sep-2026 statement for SuperCard is ready with TAD: INR 26,100.35, MAD: INR 1,397.21. Pay by 15 Sep. Details: https://2s.ms/UTKSPR/qft7VD -Utkarsh SFBL',
      sender: 'JM-UTKSPR-S',
      receivedAt: at(2026, 9, 1, 10, 0),
    },
    expected: { kind: 'statement', amountCandidates: [2610035, 139721] },
  },
];

/* -------------------------------------------------------------------------- */
/* Other banks, cards and apps                                                  */
/* -------------------------------------------------------------------------- */

export const OTHER_SENDERS: MessageFixture[] = [
  {
    name: 'HDFC card spend with an ISO timestamp',
    input: {
      body: 'Spent Rs.1,249.00 On HDFC Bank Card 1234 At AMAZON PAY INDIA On 2026-09-03:14:22:10 Not You? Call 18002586161/SMS BLOCK DC 1234 to 7308080808',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 3, 14, 23),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 124900,
      dayKey: '2026-09-03',
      time: '14:22',
      instrumentType: 'card',
      instrumentTail: '1234',
      channel: 'card',
      counterparty: 'AMAZON PAY INDIA',
      item: 'Amazon Pay India',
      confidence: 'high',
    },
  },
  {
    name: 'ICICI card spend with the available limit after it',
    input: {
      body: 'INR 2,450.00 spent using ICICI Bank Card XX9012 on 05-Sep-26 on SWIGGY. Avl Limit: INR 1,12,345.67. If not you, call 1800 2662/SMS BLOCK 9012 to 9215676766.',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 5, 21, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 245000,
      amountCandidates: [245000, 11234567],
      instrumentType: 'card',
      instrumentTail: '9012',
      counterparty: 'SWIGGY',
      item: 'Swiggy',
      confidence: 'high',
    },
  },
  {
    name: 'SBI POS debit with the balance after it',
    input: {
      body: 'Dear Customer, your A/C X8783 has been debited by Rs.450.00 on 06Sep26 for POS txn at DMART. Avl Bal Rs 12,340.50 -SBI',
      sender: 'AD-SBIINB',
      receivedAt: at(2026, 9, 6, 18, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 45000,
      dayKey: '2026-09-06',
      instrumentTail: '8783',
      channel: 'card',
      counterparty: 'DMART',
      item: 'Dmart',
      confidence: 'high',
    },
  },
  {
    name: 'SBI UPI credit with the amount glued to the mark',
    input: {
      body: 'Dear SBI UPI User, ur A/cX8783 credited by Rs2000 on 07Sep26 by  (Ref no 624911223344)',
      sender: 'BZ-SBIUPI',
      receivedAt: at(2026, 9, 7, 8, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'credit',
      amountMinor: 200000,
      instrumentTail: '8783',
      reference: '624911223344',
      item: 'Money received',
      confidence: 'medium',
    },
  },
  {
    name: 'SBI transfer phrased as a noun',
    input: {
      body: 'Your A/C XXXXX8783 has a debit by transfer of Rs 5,000.00 on 08/09/26. Avl Bal Rs 20,000.00.-SBI',
      sender: 'AD-SBIINB',
      receivedAt: at(2026, 9, 8, 12, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 500000,
      amountCandidates: [500000, 2000000],
      dayKey: '2026-09-08',
      instrumentTail: '8783',
      confidence: 'medium',
    },
  },
  {
    name: 'Axis multi-line UPI debit with the merchant in the narration',
    input: {
      body: 'INR 350.00 debited\nA/c no. XX4455\n05-09-26, 13:45:12\nUPI/P2M/624512345678/ZOMATO\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
      sender: 'AX-AXISBK',
      receivedAt: at(2026, 9, 5, 13, 46),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 35000,
      dayKey: '2026-09-05',
      time: '13:45',
      instrumentTail: '4455',
      issuer: 'Axis Bank',
      reference: '624512345678',
      counterparty: 'ZOMATO',
      item: 'Zomato',
      confidence: 'high',
    },
  },
  {
    name: 'Axis multi-line card spend with the merchant on its own line',
    input: {
      body: 'Spent\nCard no. XX7788\nINR 999\n06-09-26 19:02:11\nNETFLIX\nAvl Lmt INR 85,000\nSMS BLOCK 7788 to 919951860002, if not you - Axis Bank',
      sender: 'AX-AXISBK',
      receivedAt: at(2026, 9, 6, 19, 3),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 99900,
      time: '19:02',
      instrumentType: 'card',
      instrumentTail: '7788',
      counterparty: 'NETFLIX',
      item: 'Netflix',
      confidence: 'high',
    },
  },
  {
    name: 'Kotak UPI send to a merchant VPA',
    input: {
      body: 'Sent Rs.250.00 from Kotak Bank AC X1122 to swiggy@axisbank on 06-09-26.UPI Ref 624811112222. Not you, https://kotak.com/KBANKT/Fraud',
      sender: 'VK-KOTAKB',
      receivedAt: at(2026, 9, 6, 13, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 25000,
      instrumentTail: '1122',
      issuer: 'Kotak Bank',
      reference: '624811112222',
      counterparty: 'swiggy@axisbank',
      item: 'Swiggy',
      confidence: 'high',
    },
  },
  {
    name: 'Kotak UPI receipt',
    input: {
      body: 'Received Rs.1500.00 in your Kotak Bank AC X1122 from ramesh@oksbi on 07-09-26.UPI Ref:624922223333.',
      sender: 'VK-KOTAKB',
      receivedAt: at(2026, 9, 7, 10, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'credit',
      amountMinor: 150000,
      counterparty: 'ramesh@oksbi',
      item: 'Ramesh',
      confidence: 'high',
    },
  },
  {
    name: 'PNB UPI debit with a date prefix and a balance',
    input: {
      body: 'A/c XX1234 debited INR 500.00 Dt 07-09-26 13:12:44 thru UPI:624933334444.Bal INR 3,200.00 Not u?Fwd this SMS to 9264092640 to block UPI.-PNB',
      sender: 'VM-PNBSMS',
      receivedAt: at(2026, 9, 7, 13, 13),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 50000,
      amountCandidates: [50000, 320000],
      time: '13:12',
      instrumentTail: '1234',
      issuer: 'PNB',
      reference: '624933334444',
      counterparty: null,
      confidence: 'medium',
    },
  },
  {
    name: 'Bank of Baroda debit with two balance figures',
    input: {
      body: 'Rs.150.00 transferred from A/c ...5566 to:UPI/624944445555. Total Bal:Rs.8,000.00CR. Avlbl Amt:Rs.8,000.00(07-09-2026 10:11:12) - Bank of Baroda',
      sender: 'VM-BOBTXN',
      receivedAt: at(2026, 9, 7, 10, 12),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 15000,
      amountCandidates: [15000, 800000],
      dayKey: '2026-09-07',
      time: '10:11',
      instrumentTail: '5566',
      issuer: 'Bank of Baroda',
      reference: '624944445555',
      counterparty: null,
    },
  },
  {
    name: 'Canara debit "to your account"',
    input: {
      body: 'An amount of INR 1,000.00 has been DEBITED to your account XXX789 on 08/09/2026 towards UPI transfer. Total Avail.bal INR 5,432.10. - Canara Bank',
      sender: 'VM-CANBNK',
      receivedAt: at(2026, 9, 8, 9, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 100000,
      instrumentTail: '789',
      counterparty: null,
      confidence: 'medium',
    },
  },
  {
    name: 'Union Bank debit with "Rs:"',
    input: {
      body: 'A/c *4321 Debited for Rs:300.00 on 08-09-2026 11:22:33 by Mob Bk ref no 624955556666 Avl Bal Rs:9,000.00.If not you, Call 1800222243 -Union Bank of India',
      sender: 'VM-UNIONB',
      receivedAt: at(2026, 9, 8, 11, 23),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 30000,
      time: '11:22',
      instrumentTail: '4321',
      reference: '624955556666',
      issuer: 'Union Bank of India',
    },
  },
  {
    name: 'IDFC First UPI debit to a biller VPA',
    input: {
      body: 'Your A/C XXXXXXX1234 has been debited with INR 799.00 on 09-SEP-2026 for UPI txn to jio@axl. New bal: INR 12,000.00. - IDFC FIRST Bank',
      sender: 'JM-IDFCFB',
      receivedAt: at(2026, 9, 9, 8, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 79900,
      dayKey: '2026-09-09',
      counterparty: 'jio@axl',
      item: 'Jio',
      issuer: 'IDFC First Bank',
      confidence: 'high',
    },
  },
  {
    name: 'IndusInd card "transaction of … is successful"',
    input: {
      body: 'IndusInd Card XX5678: Transaction of INR 1,500.00 at FLIPKART on 09/09/2026 14:05:00 is successful. Available limit: INR 50,000.00',
      sender: 'VM-INDUSB',
      receivedAt: at(2026, 9, 9, 14, 6),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 150000,
      time: '14:05',
      instrumentType: 'card',
      instrumentTail: '5678',
      counterparty: 'FLIPKART',
      item: 'Flipkart',
      confidence: 'high',
    },
  },
  {
    name: 'Yes Bank UPI debit to a VPA',
    input: {
      body: 'INR 60.00 debited from A/c XX9988 on 10-SEP-26 to VPA metro@ybl. UPI Ref 625000001111. Not you? Call 18001200 - YES BANK',
      sender: 'VM-YESBNK',
      receivedAt: at(2026, 9, 10, 8, 30),
    },
    expected: { kind: 'transaction', amountMinor: 6000, item: 'Metro', issuer: 'Yes Bank', confidence: 'high' },
  },
  {
    name: 'Federal Bank UPI debit with a time',
    input: {
      body: 'Rs 200.00 debited from your A/c XX4545 to VPA uber@ybl on 10-09-2026 13:00:00. UPI Ref no 625011112222. Bal Rs 4,000.00 - Federal Bank',
      sender: 'VM-FEDBNK',
      receivedAt: at(2026, 9, 10, 13, 1),
    },
    expected: { kind: 'transaction', amountMinor: 20000, time: '13:00', item: 'Uber', reference: '625011112222' },
  },
  {
    name: 'South Indian Bank UPI debit to an acronym',
    input: {
      body: 'South Indian Bank: Rs.75.00 debited from A/c X6789 on 10-09-26 via UPI to KSRTC. Ref:625022223333. Not you? call 18004251809',
      sender: 'VM-SIBSMS',
      receivedAt: at(2026, 9, 10, 7, 0),
    },
    expected: { kind: 'transaction', amountMinor: 7500, item: 'KSRTC', reference: '625022223333', issuer: 'South Indian Bank' },
  },
  {
    name: 'AU Small Finance Bank "Debit of"',
    input: {
      body: 'Debit of INR 450.00 from A/c XX1212 on 11-SEP-26 via UPI to dmart@icici (Ref 625033334444). Avl Bal INR 3,000.00 - AU Small Finance Bank',
      sender: 'VM-AUBANK',
      receivedAt: at(2026, 9, 11, 19, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 45000,
      item: 'Dmart',
      reference: '625033334444',
      issuer: 'AU Small Finance Bank',
    },
  },
  {
    name: 'Paytm Payments Bank "paid to" with a whole-rupee amount',
    input: {
      body: 'Rs.180 paid to Big Bazaar from Paytm Payments Bank a/c XX7070. UPI Ref: 625044445555. Not you? Call 01204456456',
      sender: 'VM-PAYTMB',
      receivedAt: at(2026, 9, 11, 18, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 18000,
      dateConfidence: 'fallback_received',
      instrumentTail: '7070',
      counterparty: 'Big Bazaar',
      confidence: 'high',
    },
  },
  {
    name: 'Google Pay notification',
    input: {
      body: 'You paid ₹250.00 to Meera K',
      title: 'Google Pay',
      packageName: 'com.google.android.apps.nbu.paisa.user',
      receivedAt: at(2026, 9, 11, 13, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 25000,
      channel: 'upi',
      counterparty: 'Meera K',
      confidence: 'high',
    },
  },
  {
    name: 'PhonePe notification',
    input: {
      body: '₹99 paid to Zomato',
      title: 'Payment successful',
      packageName: 'com.phonepe.app',
      receivedAt: at(2026, 9, 11, 21, 0),
    },
    expected: { kind: 'transaction', direction: 'debit', amountMinor: 9900, item: 'Zomato', confidence: 'high' },
  },
  {
    name: 'PhonePe money received',
    input: {
      body: 'Received ₹500 from Arjun',
      packageName: 'com.phonepe.app',
      receivedAt: at(2026, 9, 11, 21, 5),
    },
    expected: { kind: 'transaction', direction: 'credit', amountMinor: 50000, item: 'Arjun' },
  },
  {
    name: 'Amazon Pay balance',
    input: {
      body: '₹349 paid to Amazon using Amazon Pay balance',
      packageName: 'in.amazon.mShop.android.shopping',
      receivedAt: at(2026, 9, 12, 10, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 34900,
      instrumentType: 'wallet',
      item: 'Amazon',
      confidence: 'high',
    },
  },
  {
    name: 'OneCard "was used for"',
    input: {
      body: 'Your OneCard ending 4321 was used for INR 299.00 at SPOTIFY on 11/09/2026 20:10.',
      sender: 'VM-ONECRD',
      receivedAt: at(2026, 9, 11, 20, 11),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 29900,
      time: '20:10',
      instrumentType: 'card',
      instrumentTail: '4321',
      item: 'Spotify',
    },
  },
  {
    name: 'slice spend with a limit',
    input: {
      body: '₹150 spent at Blinkit via slice. Available limit ₹8,500',
      sender: 'JD-SLICEP',
      receivedAt: at(2026, 9, 12, 9, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 15000,
      amountCandidates: [15000, 850000],
      item: 'Blinkit',
      issuer: 'slice',
      confidence: 'high',
    },
  },
  {
    name: 'SBI Card spend',
    input: {
      body: 'Rs.2,999.00 spent on your SBI Credit Card ending 3344 at MYNTRA on 11/09/26. Trxn. not done by you? Report at https://sbicard.com/Dispute',
      sender: 'AX-SBICRD',
      receivedAt: at(2026, 9, 11, 17, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 299900,
      instrumentType: 'card',
      instrumentTail: '3344',
      issuer: 'SBI Card',
      item: 'Myntra',
      confidence: 'high',
    },
  },
  {
    name: 'Amex with a five-digit tail and a long date',
    input: {
      body: "Alert: You've spent INR 5,600.00 on your AMEX card ** 11005 at TAJ HOTELS on 12 September 2026 at 08:30 PM IST.",
      sender: 'AD-AMEXIN',
      receivedAt: at(2026, 9, 12, 20, 31),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 560000,
      dayKey: '2026-09-12',
      time: '20:30',
      instrumentType: 'card',
      instrumentTail: '11005',
      issuer: 'American Express',
      item: 'Taj Hotels',
      confidence: 'high',
    },
  },
  {
    name: 'Salary by NEFT',
    input: {
      body: 'Dear Customer, INR 85,000.00 credited to your A/c No XX6630 on 01-SEP-26 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl Bal INR 1,02,000.00 - HDFC Bank',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 1, 10, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'credit',
      amountMinor: 8500000,
      channel: 'neft',
      counterparty: 'ACME TECHNOLOGIES PVT LTD',
      item: 'Acme Technologies Pvt Ltd',
      confidence: 'high',
    },
  },
  {
    name: 'ICICI IMPS to a beneficiary',
    input: {
      body: 'IMPS: INR 10,000.00 debited from A/c XX316 to Beneficiary MEERA K S (ICICI XXXX1111) on 09-Sep-26. IMPS Ref No 625055556666',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 9, 10, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 1000000,
      instrumentTail: '316',
      channel: 'imps',
      reference: '625055556666',
      item: 'Meera K S',
    },
  },
  {
    name: 'NEFT with "/-" and no paise',
    input: {
      body: 'Rs 1000/- debited from your A/c XX4545 on 10-09-2026 for NEFT to RAMESH TRADERS. -Federal Bank',
      sender: 'VM-FEDBNK',
      receivedAt: at(2026, 9, 10, 15, 0),
    },
    expected: { kind: 'transaction', amountMinor: 100000, channel: 'neft', item: 'Ramesh Traders' },
  },
  {
    name: 'RTGS with lakh grouping and an alphanumeric reference',
    input: {
      body: 'INR 10,00,000.50 debited from A/c XX316 on 09-Sep-26 via RTGS to SHARMA BUILDERS. Ref RTGS1234567',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 9, 12, 0),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 100000050,
      channel: 'rtgs',
      reference: 'RTGS1234567',
      item: 'Sharma Builders',
    },
  },
  {
    name: 'AutoPay that has gone through',
    input: {
      body: 'Your AutoPay of Rs.649.00 for NETFLIX has been successfully debited from HDFC Bank A/c XX6630 on 12-09-26.',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 12, 6, 0),
    },
    expected: { kind: 'transaction', amountMinor: 64900, channel: 'autopay', item: 'Netflix', confidence: 'high' },
  },
  {
    name: 'EMI debited from a savings account, not the loan account',
    input: {
      body: 'EMI of Rs 4,166.00 for loan a/c XX5566 has been debited from A/c XX6630 on 05-09-26.',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 5, 7, 0),
    },
    expected: {
      kind: 'transaction',
      direction: 'debit',
      amountMinor: 416600,
      channel: 'emi',
      instrumentTail: '6630',
      item: 'EMI',
      confidence: 'medium',
    },
  },
  {
    name: 'Card refund credit',
    input: {
      body: 'Refund of INR 1,249.00 from AMAZON has been credited to your ICICI Bank Credit Card XX9012 on 12-Sep-26.',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 12, 11, 0),
    },
    expected: {
      kind: 'refund',
      direction: 'credit',
      amountMinor: 124900,
      instrumentType: 'card',
      instrumentTail: '9012',
      counterparty: 'AMAZON',
      item: 'Amazon',
    },
  },
  {
    name: 'Foreign-currency card spend',
    input: {
      body: 'USD 12.99 spent on HDFC Bank Card 1234 at OPENAI *CHATGPT on 2026-09-10:09:15:00. Not You? Call 18002586161',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 10, 9, 16),
    },
    expected: {
      kind: 'transaction',
      amountMinor: 1299,
      currency: 'USD',
      item: 'Openai Chatgpt',
      confidence: 'medium',
    },
  },
  {
    name: 'A split long SMS: only the first fragment',
    input: {
      body: 'Rs 5',
      packageName: 'com.google.android.apps.messaging',
      title: 'AX-HDFCBK',
      receivedAt: at(2026, 9, 12, 12, 0),
    },
    expected: { kind: 'unknown', amountMinor: 500, confidence: 'low' },
  },
  {
    name: 'A no-year date received on New Year’s Day belongs to last year',
    input: {
      body: 'Dear Arjun, your SuperCard 0194 debited for INR 1,200.00 on 30 Dec 11:40 PM for UPI - 661100001111. To dispute call 18003097986 - Utkarsh SFBL',
      sender: 'JM-UTKSFB-S',
      receivedAt: at(2027, 1, 1, 0, 5),
    },
    expected: { kind: 'transaction', dayKey: '2026-12-30', time: '23:40' },
  },
  {
    name: 'A saved contact name in place of the sender id',
    input: {
      body: HDFC_SENT('120.00', 'CHAI POINT', '12/09/26', '625077778888'),
      title: 'HDFC Bank',
      packageName: 'com.google.android.apps.messaging',
      receivedAt: at(2026, 9, 12, 16, 0),
    },
    expected: { kind: 'transaction', issuer: 'HDFC Bank', item: 'Chai Point', confidence: 'high' },
  },
];

/* -------------------------------------------------------------------------- */
/* Debits that are not spending                                                 */
/* -------------------------------------------------------------------------- */

export const TRANSFERS: MessageFixture[] = [
  {
    name: 'ATM withdrawal',
    input: {
      body: 'Rs.2000.00 withdrawn at ATM S1ANBG03 from A/c X8783 on 12Sep26 Txn# 1234 Avl Bal Rs.10,000.00 -SBI',
      sender: 'AD-ATMSBI',
      receivedAt: at(2026, 9, 12, 18, 0),
    },
    expected: {
      kind: 'transfer',
      direction: 'debit',
      amountMinor: 200000,
      channel: 'atm',
      counterparty: null,
      item: 'Cash withdrawal',
    },
  },
  {
    name: 'Card bill paid through CRED',
    input: {
      body: '₹12,000 payment to your HDFC Credit Card was successful',
      packageName: 'com.dreamplug.androidapp',
      receivedAt: at(2026, 9, 12, 9, 0),
    },
    expected: { kind: 'transfer', amountMinor: 1200000 },
  },
  {
    name: 'UPI debit to CRED from a bank account',
    input: {
      body: 'Dear Customer, Rs.49,999.00 has been debited from your A/c XX316 towards CRED CLUB on 01-Sep-26. UPI Ref 624400001111.',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 1, 10, 0),
    },
    expected: { kind: 'transfer', amountMinor: 4999900, counterparty: 'CRED CLUB' },
  },
  {
    name: 'Card bill payment received by the issuer',
    input: {
      body: 'Payment of Rs 26,100.35 received towards your SuperCard ending 0194. Thank you! -Utkarsh SFBL',
      sender: 'JM-UTKSFB',
      receivedAt: at(2026, 9, 13, 10, 0),
    },
    expected: { kind: 'transfer', amountMinor: 2610035 },
  },
  {
    name: 'Wallet top-up',
    input: {
      body: 'Rs.1,000 added to your Paytm Wallet using HDFC Bank A/c XX6630. Updated balance Rs.1,250',
      sender: 'VM-PAYTMB',
      receivedAt: at(2026, 9, 13, 10, 0),
    },
    expected: { kind: 'transfer', amountMinor: 100000 },
  },
  {
    name: 'Money sent to the owner’s own other account',
    ownerName: 'Arjun K',
    input: {
      body: HDFC_SENT('5000.00', 'ARJUN K', '11/09/26', '625066667777'),
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 11, 9, 0),
    },
    expected: { kind: 'transfer', amountMinor: 500000, item: 'Arjun K' },
  },
];

/* -------------------------------------------------------------------------- */
/* Messages with amounts in them that are not transactions                      */
/* -------------------------------------------------------------------------- */

export const NOT_TRANSACTIONS: MessageFixture[] = [
  {
    name: 'OTP for a card payment',
    input: {
      body: '123456 is your OTP for txn of INR 2,450.00 at AMAZON on ICICI Bank Card XX9012. Valid for 10 mins. Do not share OTP with anyone.',
      sender: 'JD-ICICIT',
      receivedAt: at(2026, 9, 5, 20, 58),
    },
    expected: { kind: 'otp' },
  },
  {
    name: 'Cashback offer',
    input: {
      body: 'Get Rs 500 cashback on your first UPI payment with Super Money! T&C apply. Download now: https://sprmny.in/x',
      sender: 'VM-SPRMNY',
      receivedAt: at(2026, 9, 5, 11, 0),
    },
    expected: { kind: 'promo' },
  },
  {
    name: 'Card payment reminder',
    input: {
      body: 'Pay Rs 1,397.21 by 15 Sep to avoid late fee on your SuperCard. Pay now: https://2s.ms/x -Utkarsh SFBL',
      sender: 'JM-UTKSPR',
      receivedAt: at(2026, 9, 10, 10, 0),
    },
    expected: { kind: 'reminder' },
  },
  {
    name: 'Failed UPI payment that mentions debit and refund',
    input: {
      body: 'Your UPI txn of Rs 300.00 to swiggy@axisbank failed. Amount if debited will be refunded in 3-5 working days. - HDFC Bank',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 10, 12, 0),
    },
    expected: { kind: 'failed', amountMinor: 30000 },
  },
  {
    name: 'Balance enquiry',
    input: {
      body: 'Available balance in your A/c XX6630 as on 12-09-26 is Rs 45,000.00. - HDFC Bank',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 12, 8, 0),
    },
    expected: { kind: 'balance' },
  },
  {
    name: 'AutoPay that has not happened yet',
    input: {
      body: 'Your AutoPay of Rs.649.00 for NETFLIX will be debited on 15-09-26 from HDFC Bank A/c XX6630.',
      sender: 'VM-HDFCBK',
      receivedAt: at(2026, 9, 12, 6, 0),
    },
    expected: { kind: 'upcoming' },
  },
  {
    name: 'UPI collect request',
    input: {
      body: 'Meera K has requested Rs 400.00 from you on Google Pay. Pay or decline in the app.',
      packageName: 'com.google.android.apps.nbu.paisa.user',
      receivedAt: at(2026, 9, 12, 19, 0),
    },
    expected: { kind: 'reminder' },
  },
  {
    name: 'Android 15 redacted the notification',
    input: {
      body: 'Sensitive notification content hidden',
      title: 'AX-HDFCBK',
      packageName: 'com.google.android.apps.messaging',
      receivedAt: at(2026, 9, 12, 19, 0),
    },
    expected: { kind: 'unknown', amountMinor: null, confidence: 'low', reasons: ['redacted'] },
  },
];

export const ALL_MESSAGES: MessageFixture[] = [
  ...OWNER_MESSAGES,
  ...OTHER_SENDERS,
  ...TRANSFERS,
  ...NOT_TRANSACTIONS,
];
