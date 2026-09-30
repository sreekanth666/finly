import type { DatabaseSync } from 'node:sqlite';

import {
  EFFECTIVE,
  insertCardPayment,
  insertExpense,
  insertSettlement,
  NOW,
  openMigratedDatabase,
  OWED,
  rejects,
  seedCatalogue,
  SETTLED_JOIN,
} from './support';

let db: DatabaseSync;

beforeEach(() => {
  db = openMigratedDatabase();
  seedCatalogue(db);
});

afterEach(() => {
  db.close();
});

describe('the generated migration', () => {
  it('creates every table §5 specifies, plus the review inbox (D17)', () => {
    const tables = (
      db.prepare("select name from sqlite_master where type='table' order by name").all() as {
        name: string;
      }[]
    ).map((row) => row.name);

    expect(tables).toEqual([
      'accounts',
      'budgets',
      'capture_templates',
      'captured_messages',
      'card_payments',
      'categories',
      'detected_transactions',
      'expenses',
      'rule_actions',
      'rule_conditions',
      'rules',
      'settings',
      'settlements',
    ]);
  });
});

describe('the constraints SQLite can express (§5)', () => {
  it('refuses an expense of zero or less', () => {
    expect(
      rejects(
        db,
        `insert into expenses (id,occurred_at,budget_period,amount_minor,currency,item,counts_to_budget,created_at,updated_at)
         values ('x',0,'2026-08',0,'INR','free',1,0,0)`,
      ),
    ).toBe(true);
  });

  it('refuses a settlement of zero', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 50000 });
    expect(
      rejects(
        db,
        `insert into settlements (id,expense_id,amount_minor,settled_at,created_at,updated_at)
         values ('s','e1',0,0,0,0)`,
      ),
    ).toBe(true);
  });

  it('refuses an impossible statement day', () => {
    expect(
      rejects(
        db,
        `insert into accounts (id,name,type,credit_limit_minor,statement_day,color_token,sort_order,is_archived,created_at,updated_at)
         values ('a2','X','credit_card',1,32,'accent',0,0,0,0)`,
      ),
    ).toBe(true);
  });

  it('refuses a credit card with no limit', () => {
    expect(
      rejects(
        db,
        `insert into accounts (id,name,type,color_token,sort_order,is_archived,created_at,updated_at)
         values ('a3','X','credit_card','accent',0,0,0,0)`,
      ),
    ).toBe(true);
  });

  it('refuses an account type that is not one of the four', () => {
    expect(
      rejects(
        db,
        `insert into accounts (id,name,type,color_token,sort_order,is_archived,created_at,updated_at)
         values ('a4','X','crypto','accent',0,0,0,0)`,
      ),
    ).toBe(true);
  });
});

describe('soft delete (§5)', () => {
  it('excludes a deleted expense from a period total', () => {
    insertExpense(db, { id: 'live', period: '2026-08', amountMinor: 100000 });
    insertExpense(db, { id: 'gone', period: '2026-08', amountMinor: 700000, deleted: true });

    const row = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.counts_to_budget = 1 and e.budget_period = ?`,
      )
      .get('2026-08') as { spent: number };

    expect(row.spent).toBe(100000);
  });

  it('excludes a deleted settlement, so its capacity comes back', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 100000 });
    insertSettlement(db, 's-live', 'e1', 40000);
    insertSettlement(db, 's-gone', 'e1', 10000, true);

    const row = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.budget_period = ?`,
      )
      .get('2026-08') as { spent: number };

    // 100000 − 40000. The deleted 10000 must not still be reducing the expense.
    expect(row.spent).toBe(60000);
  });

  it('keeps a soft-deleted expense’s settlements alive, which is what makes undo whole', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 100000 });
    insertSettlement(db, 's1', 'e1', 40000);

    db.exec("update expenses set deleted_at = 1 where id = 'e1'");

    const remaining = db
      .prepare("select count(*) as n from settlements where expense_id='e1' and deleted_at is null")
      .get() as { n: number };

    expect(remaining.n).toBe(1);
  });
});

describe('cascade (§5)', () => {
  it('takes settlements with an expense on a hard delete', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 100000 });
    insertSettlement(db, 's1', 'e1', 40000);

    db.exec("delete from expenses where id = 'e1'");

    const left = db
      .prepare("select count(*) as n from settlements where expense_id='e1'")
      .get() as { n: number };

    expect(left.n).toBe(0);
  });

  it('takes conditions and actions with a rule', () => {
    db.exec(
      `insert into rules (id,name,priority,is_enabled,match_mode,times_applied,created_at,updated_at)
       values ('r1','Food',50,1,'all',0,0,0)`,
    );
    db.exec(
      `insert into rule_conditions (id,rule_id,field,operator,value,created_at)
       values ('rc1','r1','item','contains','swiggy',0)`,
    );
    db.exec(
      `insert into rule_actions (id,rule_id,type,value,created_at)
       values ('ra1','r1','set_category','c-food',0)`,
    );

    db.exec("delete from rules where id = 'r1'");

    const conditions = db.prepare('select count(*) as n from rule_conditions').get() as { n: number };
    const actions = db.prepare('select count(*) as n from rule_actions').get() as { n: number };

    expect(conditions.n).toBe(0);
    expect(actions.n).toBe(0);
  });

  it('will not orphan an expense by deleting the account it points at', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 100000 });
    // No ON DELETE clause on expenses.account_id, so the foreign key refuses.
    expect(rejects(db, "delete from accounts where id = 'a-card'")).toBe(true);
  });
});

describe('the budget / utilisation split (§4.5)', () => {
  it('excludes off-budget spending from the period total', () => {
    insertExpense(db, { id: 'food', period: '2026-08', amountMinor: 100000 });
    insertExpense(db, { id: 'laptop', period: '2026-08', amountMinor: 4500000, countsToBudget: false });

    const row = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.counts_to_budget = 1 and e.budget_period = ?`,
      )
      .get('2026-08') as { spent: number };

    expect(row.spent).toBe(100000);
  });

  it('still counts off-budget spending toward the card', () => {
    /*
     * §4.5: "counts_to_budget does not affect utilisation. A ₹45,000 laptop is
     * excluded from the budget but absolutely is on the card." This property is
     * enforced by the *absence* of a WHERE clause, which is exactly the kind of
     * thing that regresses without anyone noticing.
     */
    insertExpense(db, { id: 'food', period: '2026-08', amountMinor: 100000 });
    insertExpense(db, { id: 'laptop', period: '2026-08', amountMinor: 4500000, countsToBudget: false });

    const row = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.account_id = ?`,
      )
      .get('a-card') as { spent: number };

    expect(row.spent).toBe(4600000);
  });
});

describe('off-budget spend and the month total (D3)', () => {
  const spent = (where: string): number =>
    (
      db
        .prepare(
          `select coalesce(${EFFECTIVE}, 0) as spent from expenses e ${SETTLED_JOIN}
           where e.deleted_at is null and e.budget_period = ? ${where}`,
        )
        .get('2026-08') as { spent: number }
    ).spent;

  it('nets a settlement and skips a deleted expense on the off-budget side too', () => {
    insertExpense(db, { id: 'laptop', period: '2026-08', amountMinor: 4500000, countsToBudget: false });
    insertSettlement(db, 's1', 'laptop', 500000);
    insertExpense(db, { id: 'gone', period: '2026-08', amountMinor: 900000, countsToBudget: false, deleted: true });
    insertExpense(db, { id: 'food', period: '2026-08', amountMinor: 100000 });

    expect(spent('and e.counts_to_budget = 0')).toBe(4000000);
  });

  it('splits the month into two sides that add back up to all of it', () => {
    insertExpense(db, { id: 'food', period: '2026-08', amountMinor: 100000 });
    insertSettlement(db, 's1', 'food', 25000);
    insertExpense(db, { id: 'laptop', period: '2026-08', amountMinor: 4500000, countsToBudget: false });
    insertExpense(db, { id: 'other-month', period: '2026-07', amountMinor: 300000, countsToBudget: false });

    const budget = spent('and e.counts_to_budget = 1');
    const offBudget = spent('and e.counts_to_budget = 0');

    expect(budget).toBe(75000);
    expect(offBudget).toBe(4500000);
    expect(budget + offBudget).toBe(spent(''));
  });
});

describe('the settlement cap (§5)', () => {
  /** Mirrors addSettlement: read the total, compare, then insert. */
  const tryAdd = (expenseId: string, amount: number, expenseAmount: number): boolean => {
    const settled = (
      db
        .prepare(
          'select coalesce(sum(amount_minor),0) as total from settlements where expense_id = ? and deleted_at is null',
        )
        .get(expenseId) as { total: number }
    ).total;

    if (amount > expenseAmount - settled) return false;
    insertSettlement(db, `s-${settled}-${amount}`, expenseId, amount);
    return true;
  };

  it('accepts up to the expense and refuses beyond it', () => {
    insertExpense(db, { id: 'e1', period: '2026-08', amountMinor: 50000 });

    expect(tryAdd('e1', 20000, 50000)).toBe(true);
    expect(tryAdd('e1', 20000, 50000)).toBe(true);
    expect(tryAdd('e1', 20000, 50000)).toBe(false);
    expect(tryAdd('e1', 10000, 50000)).toBe(true);
    expect(tryAdd('e1', 1, 50000)).toBe(false);
  });

  it('reads as exactly zero once fully settled — the §4.3 recharge case', () => {
    insertExpense(db, { id: 'recharge', period: '2026-02', amountMinor: 50000 });
    insertSettlement(db, 's1', 'recharge', 50000);

    const row = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.budget_period = ?`,
      )
      .get('2026-02') as { spent: number };

    expect(row.spent).toBe(0);
  });
});

describe('card payments and what a card owes (D20)', () => {
  const DAY = 86_400_000;
  const ANCHOR = NOW;

  const anchor = (owedMinor: number, at = ANCHOR) =>
    db.exec(`update accounts set opening_owed_minor = ${owedMinor}, opening_owed_at = ${at} where id = 'a-card'`);

  const owed = (): number => (db.prepare(OWED).get('a-card') as { owed: number }).owed;

  it('refuses a payment of zero', () => {
    expect(
      rejects(
        db,
        `insert into card_payments (id,account_id,amount_minor,paid_at,source,created_at,updated_at)
         values ('p','a-card',0,0,'manual',0,0)`,
      ),
    ).toBe(true);
  });

  it('refuses a payment toward a card that does not exist', () => {
    expect(
      rejects(
        db,
        `insert into card_payments (id,account_id,amount_minor,paid_at,source,created_at,updated_at)
         values ('p','no-such-card',100,0,'manual',0,0)`,
      ),
    ).toBe(true);
  });

  it('adds spending and subtracts payments made after the anchor', () => {
    anchor(1845000);
    insertExpense(db, { id: 'dinner', period: '2026-10', amountMinor: 320000, occurredAt: ANCHOR + DAY });
    insertCardPayment(db, { id: 'p1', amountMinor: 1845000, paidAt: ANCHOR + 2 * DAY });

    expect(owed()).toBe(320000);
  });

  it('ignores everything before the anchor — it is already in the figure the user entered', () => {
    insertExpense(db, { id: 'old-purchase', period: '2026-09', amountMinor: 900000, occurredAt: ANCHOR - DAY });
    insertCardPayment(db, { id: 'old-payment', amountMinor: 500000, paidAt: ANCHOR - DAY });
    anchor(1000000);

    expect(owed()).toBe(1000000);
  });

  it('skips a deleted payment and a deleted expense', () => {
    anchor(0);
    insertExpense(db, { id: 'kept', period: '2026-10', amountMinor: 100000, occurredAt: ANCHOR + DAY });
    insertExpense(db, { id: 'gone', period: '2026-10', amountMinor: 700000, occurredAt: ANCHOR + DAY, deleted: true });
    insertCardPayment(db, { id: 'undone', amountMinor: 50000, paidAt: ANCHOR + DAY, deleted: true });

    expect(owed()).toBe(100000);
  });

  it('nets money back on a card purchase, as utilisation always has', () => {
    anchor(0);
    insertExpense(db, { id: 'shoes', period: '2026-10', amountMinor: 400000, occurredAt: ANCHOR + DAY });
    insertSettlement(db, 'refund', 'shoes', 150000);

    expect(owed()).toBe(250000);
  });

  it('goes negative when more was paid than owed', () => {
    anchor(100000);
    insertCardPayment(db, { id: 'p1', amountMinor: 150000, paidAt: ANCHOR + DAY });

    expect(owed()).toBe(-50000);
  });

  it('counts only the card it belongs to', () => {
    db.exec(
      `insert into accounts (id,name,type,credit_limit_minor,statement_day,color_token,sort_order,is_archived,created_at,updated_at)
       values ('a-other','ICICI','credit_card',200000,5,'accent',1,0,${NOW},${NOW})`,
    );
    anchor(0);
    insertCardPayment(db, { id: 'elsewhere', accountId: 'a-other', amountMinor: 90000, paidAt: ANCHOR + DAY });

    expect(owed()).toBe(0);
  });

  it('takes a converted bill payment out of the budget while lowering what the card owes', () => {
    /* The workaround this replaces: the bill logged as an expense. Converting
       soft-deletes it and writes the payment, in one transaction. */
    anchor(2200000);
    insertExpense(db, { id: 'food', period: '2026-10', amountMinor: 100000, occurredAt: ANCHOR + DAY, accountId: null });
    insertExpense(db, {
      id: 'bill',
      period: '2026-10',
      amountMinor: 2200000,
      occurredAt: ANCHOR + DAY,
      countsToBudget: false,
      accountId: null,
    });

    db.exec(`update expenses set deleted_at = ${NOW} where id = 'bill'`);
    db.exec(
      `insert into card_payments (id,account_id,amount_minor,paid_at,source,expense_id,created_at,updated_at)
       values ('p-bill','a-card',2200000,${ANCHOR + DAY},'converted','bill',${NOW},${NOW})`,
    );

    const month = db
      .prepare(
        `select ${EFFECTIVE} as spent from expenses e ${SETTLED_JOIN}
         where e.deleted_at is null and e.budget_period = ?`,
      )
      .get('2026-10') as { spent: number };

    expect(month.spent).toBe(100000);
    expect(owed()).toBe(0);
  });

  it('keeps a payment when the expense it was converted from is purged', () => {
    insertExpense(db, { id: 'bill', period: '2026-10', amountMinor: 50000, accountId: null });
    db.exec(
      `insert into card_payments (id,account_id,amount_minor,paid_at,source,expense_id,created_at,updated_at)
       values ('p','a-card',50000,${NOW},'converted','bill',${NOW},${NOW})`,
    );

    db.exec("delete from expenses where id = 'bill'");

    const row = db.prepare("select expense_id from card_payments where id = 'p'").get() as {
      expense_id: string | null;
    };
    expect(row.expense_id).toBeNull();
  });

  it('will not orphan a payment by deleting the card it paid', () => {
    insertCardPayment(db, { id: 'p', amountMinor: 50000 });
    expect(rejects(db, "delete from accounts where id = 'a-card'")).toBe(true);
  });
});
