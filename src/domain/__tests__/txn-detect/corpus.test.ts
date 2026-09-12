import { dayKey, formatTime } from '@/domain/period';
import { detect, type Detection } from '@/domain/txn-detect';

import {
  ALL_MESSAGES,
  NOT_TRANSACTIONS,
  TRANSFERS,
  type MessageExpectation,
  type MessageFixture,
} from '../fixtures/messages';

/** The detection, reduced to the fields a fixture can state. */
function observe(detection: Detection): Required<MessageExpectation> {
  return {
    kind: detection.kind,
    direction: detection.direction,
    amountMinor: detection.amountMinor,
    amountCandidates: detection.amountCandidates,
    currency: detection.currency,
    dayKey: dayKey(detection.occurredAt),
    time: formatTime(detection.occurredAt),
    dateConfidence: detection.dateConfidence,
    instrumentType: detection.instrumentType,
    instrumentTail: detection.instrumentTail,
    issuer: detection.issuer,
    reference: detection.reference,
    channel: detection.channel,
    counterparty: detection.counterparty,
    item: detection.item,
    confidence: detection.confidence,
    reasons: detection.reasons,
  };
}

const run = (fixture: MessageFixture) =>
  detect(fixture.input, { ownerName: fixture.ownerName ?? null });

describe('the message corpus', () => {
  it.each(ALL_MESSAGES.map((fixture) => [fixture.name, fixture] as const))('%s', (_, fixture) => {
    const seen = observe(run(fixture));
    const { reasons, ...expected } = fixture.expected;

    const picked = Object.fromEntries(
      Object.keys(expected).map((key) => [key, seen[key as keyof MessageExpectation]]),
    );
    expect(picked).toEqual(expected);

    for (const reason of reasons ?? []) {
      expect(seen.reasons).toContain(reason);
    }
  });
});

describe('what the corpus as a whole promises', () => {
  it('never calls an OTP, offer, reminder, statement or failure a transaction', () => {
    for (const fixture of NOT_TRANSACTIONS) {
      expect([fixture.name, run(fixture).kind]).not.toEqual([fixture.name, 'transaction']);
    }
  });

  it('never calls a card bill, an investment or a top-up spending', () => {
    for (const fixture of TRANSFERS) {
      expect([fixture.name, run(fixture).kind]).toEqual([fixture.name, 'transfer']);
    }
  });

  it('keeps the amount whenever one was written, however unsure it is of the rest', () => {
    for (const fixture of ALL_MESSAGES) {
      if (fixture.expected.amountMinor == null) continue;
      expect([fixture.name, run(fixture).amountMinor]).toEqual([
        fixture.name,
        fixture.expected.amountMinor,
      ]);
    }
  });

  it('only calls itself certain when the amount, direction and payee are all there', () => {
    for (const fixture of ALL_MESSAGES) {
      const detection = run(fixture);
      if (detection.confidence !== 'high') continue;
      expect(detection.amountMinor).not.toBeNull();
      expect(detection.direction).not.toBeNull();
      expect(detection.counterparty).not.toBeNull();
      expect(detection.currency).toBe('INR');
    }
  });

  it('is deterministic', () => {
    for (const fixture of ALL_MESSAGES) {
      expect(run(fixture)).toEqual(run(fixture));
    }
  });
});
