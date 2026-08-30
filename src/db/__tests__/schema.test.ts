import type { DatabaseSync } from 'node:sqlite';

import {
  EFFECTIVE,
  insertExpense,
  insertSettlement,
  openMigratedDatabase,
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
  it('creates every table §5 specifies', () => {
    const tables = (
      db.prepare("select name from sqlite_master where type='table' order by name").all() as {
        name: string;
      }[]
    ).map((row) => row.name);

    expect(tables).toEqual([
      'accounts',
      'budgets',
      'categories',
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
