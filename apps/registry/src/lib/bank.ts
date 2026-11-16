// The payment account details — ONE source of truth, swapped in one place.
//
// For testing (Kai, 16 Nov): the family account details go in .env as
// BANK_* variables so the whole Phase 2 loop can be exercised before the
// school's Q-P4 answers arrive. When NMU's dedicated account lands, ONLY
// these environment values change — no code, no schema, no letters.
//
// The banner on the payment surfaces comes from `isTemporaryAccount`: while
// a temporary account is configured, every payment card and ledger screen
// says so honestly. Nothing pretends to be the school's account.

export interface BankAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: string;
  temporary: boolean;
}

export function getBankAccount(): BankAccount {
  return {
    accountName: process.env.BANK_ACCOUNT_NAME ?? "NMU Business Registration Account",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "0000000000",
    bankName: process.env.BANK_NAME ?? "—",
    accountType: process.env.BANK_ACCOUNT_TYPE ?? "current",
    temporary: process.env.BANK_TEMPORARY === "1",
  };
}
