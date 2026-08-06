/**
 * Every read query in the app lives here.
 *
 * Rules:
 *   - server only, always through the session-bound client, so RLS applies
 *   - anything that aggregates goes through a Postgres RPC rather than pulling
 *     rows into JavaScript and adding them up here
 *   - these throw on failure; pages let the error boundary handle it
 */
import 'server-only';
import { createClient } from './supabase-server';
import { todayISO } from './date-helpers';

/** Turns a Supabase { data, error } into data, or throws something readable. */
function unwrap({ data, error }, what) {
  if (error) {
    throw new Error(`Could not load ${what}: ${error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Configuration: tanks, nozzles, prices
// ---------------------------------------------------------------------------

export async function getTanks() {
  const supabase = await createClient();
  return unwrap(
    await supabase.from('tanks').select('*').order('fuel_type'),
    'the tanks',
  );
}

export async function getNozzles() {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('nozzles')
      .select('*, tank:tanks(id, name, fuel_type)')
      .order('unit_number')
      .order('nozzle_label'),
    'the nozzles',
  );
}

export async function getFuelPrices() {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('fuel_prices')
      .select('*')
      .order('effective_from', { ascending: false })
      .limit(50),
    'the fuel prices',
  );
}

/**
 * The rate in force for each fuel, as { petrol: 280, diesel: 275 }.
 *
 * The date is always sent explicitly rather than left to the database default,
 * so the app and Postgres cannot disagree about which day it is.
 */
export async function getCurrentRates(onDate) {
  const supabase = await createClient();
  const rates = {};
  const date = onDate ?? todayISO();

  for (const fuelType of ['petrol', 'diesel']) {
    const { data, error } = await supabase.rpc('current_fuel_rate', {
      p_fuel_type: fuelType,
      p_date: date,
    });
    if (error) throw new Error(`Could not load the ${fuelType} rate: ${error.message}`);
    rates[fuelType] = data === null ? null : Number(data);
  }

  return rates;
}

// ---------------------------------------------------------------------------
// Daily readings
// ---------------------------------------------------------------------------

/**
 * The whole daily entry screen in one call: every nozzle with its opening
 * reading prefilled, the rate for the day, and anything already entered.
 */
export async function getReadingSheet(date) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_reading_sheet', { p_date: date }),
    "the day's reading sheet",
  );
}

/**
 * Credit slips for a set of readings, keyed by reading id.
 *
 * Takes ids rather than filtering through the parent table, because filtering
 * on an embedded resource in PostgREST is easy to get subtly wrong.
 */
export async function getCreditSalesForReadings(readingIds = []) {
  if (readingIds.length === 0) return {};

  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from('credit_sales')
      .select('*, customer:customers(id, name, vehicle_number)')
      .in('reading_id', readingIds),
    'the credit slips',
  );

  return rows.reduce((byReading, row) => {
    (byReading[row.reading_id] ||= []).push(row);
    return byReading;
  }, {});
}

export async function getRecentReadings(limit = 60) {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('nozzle_readings')
      .select('*, nozzle:nozzles(unit_number, nozzle_label, tank:tanks(fuel_type))')
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    'the recent readings',
  );
}

// ---------------------------------------------------------------------------
// Fuel purchases
// ---------------------------------------------------------------------------

export async function getPurchases({ limit = 100 } = {}) {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('fuel_purchases')
      .select('*, tank:tanks(id, name, fuel_type)')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    'the fuel purchases',
  );
}

// ---------------------------------------------------------------------------
// Lubricants
//
// The shelf of engine oil and the rest: the products, what comes in from the
// distributor, and what goes out over the counter. Everything is measured in
// litres, whether it left as a sealed 4 L carton or as 250 ml poured loose.
// ---------------------------------------------------------------------------

/** The product list. Retired products are left out unless asked for. */
export async function getLubricants({ includeRetired = false } = {}) {
  const supabase = await createClient();

  let query = supabase.from('lubricants').select('*');
  if (!includeRetired) query = query.eq('is_active', true);

  return unwrap(await query.order('name'), 'the lubricants');
}

/**
 * The shelf as at a date: bought, sold and what is left, per product.
 *
 * Aggregated in Postgres like every other stock figure, so the Stock page and
 * the monthly report cannot arrive at different answers.
 */
export async function getLubricantStock(date) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_lubricant_stock', { p_date: date ?? todayISO() }),
    'the lubricant stock',
  );
}

/** One day of counter sales with its totals - the whole Lubricants screen. */
export async function getLubricantDay(date) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_lubricant_day', { p_date: date ?? todayISO() }),
    "the day's lubricant sales",
  );
}

export async function getLubricantPurchases({ limit = 100 } = {}) {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('lubricant_purchases')
      .select('*, lubricant:lubricants(id, name, pack_size_litres)')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    'the lubricant purchases',
  );
}

// ---------------------------------------------------------------------------
// Stock checks
// ---------------------------------------------------------------------------

export async function getStockChecks({ limit = 60 } = {}) {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('stock_checks')
      .select('*, tank:tanks(id, name, fuel_type)')
      .order('check_date', { ascending: false })
      .limit(limit),
    'the stock checks',
  );
}

/** What the books say should be in a tank at the end of a given date. */
export async function getExpectedStock(tankId, date) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('calculate_expected_stock', {
    p_tank_id: tankId,
    p_date: date,
  });
  if (error) throw new Error(`Could not work out the expected stock: ${error.message}`);
  return data === null ? null : Number(data);
}

/** Expected stock for every tank on a date, ready for the stock check form. */
export async function getExpectedStockForAllTanks(date) {
  const tanks = await getTanks();
  return Promise.all(
    tanks.map(async (tank) => ({
      ...tank,
      expected_stock: await getExpectedStock(tank.id, date),
    })),
  );
}

// ---------------------------------------------------------------------------
// Customers and the ledger
// ---------------------------------------------------------------------------

export async function getCustomers() {
  const supabase = await createClient();
  return unwrap(
    await supabase.from('customers').select('*').eq('is_active', true).order('name'),
    'the customers',
  );
}

/** Every customer with their outstanding balance - one query, not one each. */
export async function getCustomerBalances() {
  const supabase = await createClient();
  return unwrap(await supabase.rpc('get_customer_balances'), 'the customer balances');
}

export async function getCustomerStatement(customerId) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_customer_statement', { p_customer_id: customerId }),
    'the customer statement',
  );
}

export async function getLedgerEntries(customerId, { limit = 500 } = {}) {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('ledger_entries')
      .select('*')
      .eq('customer_id', customerId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    'the ledger entries',
  );
}

// ---------------------------------------------------------------------------
// Dashboard and reports - all aggregated in Postgres
// ---------------------------------------------------------------------------

export async function getDailySummary(date) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_daily_summary', { p_date: date }),
    "the day's summary",
  );
}

export async function getSalesTrend(from, to) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_sales_trend', { p_from: from, p_to: to }),
    'the sales trend',
  );
}

export async function getMonthlyReport(year, month) {
  const supabase = await createClient();
  return unwrap(
    await supabase.rpc('get_monthly_report', { p_year: year, p_month: month }),
    'the monthly report',
  );
}

// ---------------------------------------------------------------------------
// Expenses and staff accounts (super_admin only - RLS enforces it)
// ---------------------------------------------------------------------------

/**
 * The recorded expenses, newest first.
 *
 * `from`/`to` are inclusive ISO dates - the Expenses page passes the month on
 * screen, so its table and its totals describe the same set of rows. Left out,
 * it returns the most recent ones regardless of month.
 */
export async function getExpenses({ from, to, limit = 100 } = {}) {
  const supabase = await createClient();

  let query = supabase.from('expenses').select('*');
  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);

  return unwrap(
    await query.order('expense_date', { ascending: false }).limit(limit),
    'the expenses',
  );
}

export async function getProfiles() {
  const supabase = await createClient();
  return unwrap(
    await supabase.from('profiles').select('*').order('full_name'),
    'the staff accounts',
  );
}

// ---------------------------------------------------------------------------
// Banking
//
// The owner's own accounts: cash paid in, pump costs paid out by transfer.
// Owner only - the RLS policies refuse a data_entry caller outright.
// ---------------------------------------------------------------------------

/** Each account with its balance and lifetime totals, from the view. */
export async function getBankAccounts() {
  const supabase = await createClient();
  return unwrap(
    await supabase.from('bank_account_balances').select('*').order('created_at'),
    'the bank accounts',
  );
}

/**
 * The transactions on screen.
 *
 * No limit is passed by the page and none is needed: the database keeps at most
 * 60 rows per account, so "everything there is" is already a small number.
 */
export async function getBankTransactions() {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from('bank_transactions')
      .select('*, account:bank_accounts(id, bank_name, account_label)')
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false }),
    'the bank transactions',
  );
}
