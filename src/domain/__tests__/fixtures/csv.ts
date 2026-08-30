/**
 * The two CSV documents the design pass shipped as a stand-in for a file picker.
 *
 * They are kept because they are genuinely good parser fixtures: a quoted field
 * containing a comma, an unparseable amount, a row with no description, and a
 * second file written in an entirely different dialect with day-first dates.
 */

export const SHEET_EXPORT = [
  'date,items,note,amount,from',
  '2026-08-01,Rent,,850,ICICI Bank',
  '2026-08-02,Swiggy,"Dinner, ordered late",24.50,HDFC Millennia',
  '2026-08-03,Groceries,Weekly shop,62.30,HDFC Millennia',
  '2026-08-05,Electricity Bill,,45.60,ICICI Bank',
  '2026-08-07,Uber,Airport run,31.20,Cash',
  '2026-08-09,Pharmacy,,18.40,Cash',
  '2026-08-11,New Headphones,"Returned later, kept the receipt",129.99,HDFC Millennia',
  '2026-08-12,,,12.00,Cash',
  '2026-08-14,Petrol,,n/a,Cash',
  '2026-08-16,Coffee,,4.50,Cash',
].join('\n');

export const BANK_EXPORT = [
  'Transaction Date,Description,Debit,Account Name',
  '15/08/2026,SWIGGY BANGALORE,412.00,HDFC Millennia',
  '16/08/2026,BESCOM BILL PAY,1240.50,ICICI Bank',
  '17/08/2026,UBER INDIA,286.00,HDFC Millennia',
].join('\n');

/**
 * The case neither of the above covers, and the one that actually matters:
 * every component is 12 or below, so DD/MM and MM/DD are indistinguishable from
 * the data alone.
 */
export const AMBIGUOUS_EXPORT = [
  'date,item,amount',
  '03/04/2026,Chemist,120',
  '05/06/2026,Petrol,900',
].join('\n');
