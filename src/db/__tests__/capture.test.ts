import type { DatabaseSync } from 'node:sqlite';

import { insertExpense, openMigratedDatabase, rejects, seedCatalogue } from './support';

/*
 * The SQL contract of the review inbox (D17): what a captured message and a
 * detected candidate may hold, and what happens to them when the rows they
 * point at go away.
 */

const NOW = 1_760_000_000_000;

let db: DatabaseSync;

beforeEach(() => {
  db = openMigratedDatabase();
  seedCatalogue(db);
});

afterEach(() => {
  db.close();
});

const message = (id: string, hash = `h-${id}`, source = 'notification') =>
  `insert into captured_messages (id,source,package_name,sender,title,body,posted_at,received_at,content_hash,created_at)
   values ('${id}','${source}','com.google.android.apps.messaging','VM-HDFCBK',null,'Sent Rs.500.00',${NOW},${NOW},'${hash}',${NOW})`;

type CandidateSeed = {
  id: string;
  messageId: string;
  amount?: string;
  status?: string;
  kind?: string;
  expenseId?: string | null;
  accountId?: string | null;
};

const candidate = ({ id, messageId, amount = '50000', status = 'pending', kind = 'transaction', expenseId = null, accountId = null }: CandidateSeed) =>
  `insert into detected_transactions
     (id,message_id,kind,direction,amount_minor,currency,occurred_at,date_confidence,item,confidence,
      suggested_account_id,status,expense_id,parser_version,created_at,updated_at)
   values ('${id}','${messageId}','${kind}','debit',${amount},'INR',${NOW},'exact','Meera K S','high',
      ${accountId === null ? 'null' : `'${accountId}'`},'${status}',${expenseId === null ? 'null' : `'${expenseId}'`},1,${NOW},${NOW})`;

describe('captured messages', () => {
  it('stores a message once, however many times it is delivered', () => {
    db.exec(message('m1', 'same'));
    expect(rejects(db, message('m2', 'same'))).toBe(true);
  });

  it('only knows the three ways a message can arrive', () => {
    expect(rejects(db, message('m1', 'h1', 'sms'))).toBe(true);
    expect(rejects(db, message('m2', 'h2', 'paste'))).toBe(false);
  });
});

describe('detected transactions', () => {
  beforeEach(() => {
    db.exec(message('m1'));
  });

  it('keeps a candidate whose amount could not be read', () => {
    expect(rejects(db, candidate({ id: 'd1', messageId: 'm1', amount: 'null' }))).toBe(false);
  });

  it('refuses a zero or negative amount, like an expense does', () => {
    expect(rejects(db, candidate({ id: 'd1', messageId: 'm1', amount: '0' }))).toBe(true);
    expect(rejects(db, candidate({ id: 'd2', messageId: 'm1', amount: '-5' }))).toBe(true);
  });

  it('refuses a status or kind nothing knows how to show', () => {
    expect(rejects(db, candidate({ id: 'd1', messageId: 'm1', status: 'approved' }))).toBe(true);
    expect(rejects(db, candidate({ id: 'd2', messageId: 'm1', kind: 'income' }))).toBe(true);
  });

  it('must belong to a message', () => {
    expect(rejects(db, candidate({ id: 'd1', messageId: 'nope' }))).toBe(true);
  });

  it('goes when retention hard-deletes its message', () => {
    db.exec(candidate({ id: 'd1', messageId: 'm1' }));
    db.exec(`delete from captured_messages where id = 'm1'`);
    expect(db.prepare('select count(*) as n from detected_transactions').get()).toEqual({ n: 0 });
  });

  it('survives its suggested account being deleted, losing only the suggestion', () => {
    db.exec(candidate({ id: 'd1', messageId: 'm1', accountId: 'a-card' }));
    db.exec(`delete from accounts where id = 'a-card'`);
    expect(db.prepare(`select suggested_account_id as a from detected_transactions`).get()).toEqual({ a: null });
  });

  it('points at the expense it became', () => {
    insertExpense(db, { id: 'e1', period: '2025-10', amountMinor: 50000 });
    db.exec(candidate({ id: 'd1', messageId: 'm1', status: 'confirmed', expenseId: 'e1' }));
    expect(rejects(db, candidate({ id: 'd2', messageId: 'm1', expenseId: 'missing' }))).toBe(true);
  });
});

describe('expenses, after D17', () => {
  it('are manual unless something says otherwise, and existing rows need nothing', () => {
    insertExpense(db, { id: 'e1', period: '2025-10', amountMinor: 100 });
    expect(db.prepare(`select source, source_text as text from expenses where id = 'e1'`).get()).toEqual({
      source: 'manual',
      text: null,
    });
  });
});
