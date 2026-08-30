/**
 * Files the import flow can be handed.
 *
 * Design-pass stand-in for a document picker: adding `expo-document-picker`
 * would pull in a native module this pass can't exercise, so the pick step
 * offers these instead. The contents are real CSV and go through the real
 * parser — only the picking is simulated.
 *
 * The first file uses the exact column names of the sheet this app exists to
 * replace (§3: date, items, note, amount, from), including a note with a comma
 * in it, an unparseable amount and a row with no item — so the mapping guess
 * and the preview's problem reporting both have something to chew on.
 */

export type PickableFile = {
  id: string;
  name: string;
  size: string;
  content: string;
};

const SHEET_EXPORT = [
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

const BANK_EXPORT = [
  'Transaction Date,Description,Debit,Account Name',
  '15/08/2026,SWIGGY BANGALORE,412.00,HDFC Millennia',
  '16/08/2026,BESCOM BILL PAY,1240.50,ICICI Bank',
  '17/08/2026,UBER INDIA,286.00,HDFC Millennia',
].join('\n');

export const pickableFiles: PickableFile[] = [
  {
    id: 'f-1',
    name: 'expenses-2026-08.csv',
    size: '10 rows · 612 B',
    content: SHEET_EXPORT,
  },
  {
    id: 'f-2',
    name: 'hdfc-statement-aug.csv',
    size: '3 rows · 198 B',
    content: BANK_EXPORT,
  },
];
