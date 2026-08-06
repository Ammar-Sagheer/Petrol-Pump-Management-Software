'use server';

/**
 * Every mutation in the app.
 *
 * House rules:
 *   - the FIRST line of every action is requireRole(...), no exceptions
 *   - actions return { ok, message } so forms can show the result with
 *     useActionState, rather than throwing at the user
 *   - money and litres are recomputed here from the raw inputs; whatever the
 *     browser posted for a total is treated as a hint, never as fact
 *   - the database has the final say - if a constraint refuses a write, its
 *     message is passed straight through, because those messages are the ones
 *     that actually explain what is wrong
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from './supabase-server';
import { createAdminClient, createPasswordCheckClient } from './supabase-auth';
import {
  requireRole,
  ROLES,
  roundMoney,
  landingPageFor,
  fullResetAllowed,
  formatLitres,
  formatPKR,
  formatRate,
} from './helpers';

// ---------------------------------------------------------------------------
// Small input helpers
// ---------------------------------------------------------------------------

const ok = (message) => ({ ok: true, message });
const fail = (message) => ({ ok: false, message });

function text(formData, field) {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function number(formData, field) {
  const raw = text(formData, field);
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turns a database error into something worth reading.
 *
 * The check constraints and triggers were written with human-readable messages
 * precisely so they could be shown here rather than swallowed.
 */
function describe(error, fallback) {
  if (!error) return fallback;
  const message = error.message ?? String(error);

  if (message.includes('nozzle_readings_split_matches_sale')) {
    return 'Cash plus credit does not equal the amount sold. Check the figures and try again.';
  }
  if (message.includes('nozzle_readings_closing_gte_opening')) {
    return 'The closing reading is lower than the opening reading. A meter cannot run backwards.';
  }
  if (message.includes('nozzle_readings_nozzle_id_reading_date_shift_key')) {
    return 'This nozzle has already been entered for that date.';
  }
  if (message.includes('stock_checks_tank_id_check_date_key')) {
    return 'A stock check for that tank and date has already been recorded.';
  }
  if (message.includes('fuel_prices_fuel_type_effective_from_key')) {
    return 'A rate for that fuel and date already exists. Pick a different date to change it.';
  }
  if (message.includes('append-only')) {
    return 'The ledger cannot be edited. Post a new offsetting entry instead.';
  }
  if (message.includes('lubricants_active_name_unique')) {
    return 'A lubricant with that name is already on the list. Use a different name, or edit the one that is there.';
  }
  if (message.includes('lubricant_sales_split_matches_amount')) {
    return 'Cash plus credit does not equal the amount of the sale. Check the figures and try again.';
  }
  if (message.includes('lubricant_sales_credit_needs_customer')) {
    return 'Choose the customer this was given to on credit.';
  }
  return message || fallback;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function signIn(_prevState, formData) {
  const email = text(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const next = text(formData, 'next');

  if (!email || !password) {
    return fail('Enter your email and password.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Bad email or password. Deliberately vague - never reveal whether an
    // account with that email exists.
    if (error.status === 400 || error.code === 'invalid_credentials') {
      return fail('Those details did not work. Check your email and password.');
    }

    // Anything else means the server could not be reached or is unwell. Saying
    // "check your password" here would send someone hunting for a typo that
    // isn't there.
    return fail(
      'Could not reach the server just now. Check the internet connection and try again.',
    );
  }

  const { data: claims } = await supabase.auth.getClaims();
  let destination = next && next.startsWith('/admin') ? next : null;

  if (!destination) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', claims?.claims?.sub)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      return fail('This account has been deactivated. Ask the owner to re-enable it.');
    }

    destination = landingPageFor(profile.role);
  }

  // redirect() throws internally, so it has to sit outside any try/catch.
  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

/**
 * Changes your OWN password. Both roles - this is not account management.
 *
 * The owner hands out a password when he creates a login, so everyone needs a
 * way to replace it with something only they know. Nobody can change anyone
 * else's here: the new password is applied to whoever is signed in, taken from
 * the session, never from the form.
 *
 * The current password is checked first, on purpose. Supabase does not require
 * it, but without that check anyone who found an unlocked phone with the app
 * still open could lock the owner out of his own books in two taps.
 */
export async function changePassword(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const currentPassword = String(formData.get('current_password') ?? '');
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!currentPassword || !newPassword) {
    return fail('Fill in your current password and the new one.');
  }
  if (newPassword.length < 8) {
    return fail('The new password must be at least 8 characters.');
  }
  if (newPassword !== confirmPassword) {
    return fail('The two new passwords do not match.');
  }
  if (newPassword === currentPassword) {
    return fail('The new password is the same as the current one.');
  }
  if (!profile.email) {
    return fail('Could not read your email address. Sign out and in again, then retry.');
  }

  // Check the current password on a throwaway client so this cannot disturb
  // the session that is running the form.
  const checkClient = createPasswordCheckClient();
  const { error: checkError } = await checkClient.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (checkError) {
    if (checkError.status === 400 || checkError.code === 'invalid_credentials') {
      return fail('Your current password is not right.');
    }
    return fail('Could not reach the server just now. Try again in a moment.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    // Supabase enforces its own rules too (length, leaked-password checks).
    return fail(describe(error, 'Could not change the password.'));
  }

  return ok('Password changed. Use the new one next time you sign in.');
}

// ---------------------------------------------------------------------------
// Daily nozzle readings - the core daily habit
// ---------------------------------------------------------------------------

/**
 * Saves one nozzle's day, together with its credit slips, in one transaction.
 *
 * The cash figure is derived here (total sold minus the slips) rather than
 * taken from the form, so cash can never be quietly wrong.
 */
export async function saveReading(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const nozzleId = text(formData, 'nozzle_id');
  const readingDate = text(formData, 'reading_date');
  const opening = number(formData, 'opening_reading');
  const closing = number(formData, 'closing_reading');
  const rate = number(formData, 'rate_per_litre');

  if (!nozzleId || !readingDate) return fail('Missing the nozzle or the date.');
  if (opening === null) return fail('Enter the opening reading.');
  if (closing === null) return fail('Enter the closing reading.');
  if (rate === null || rate <= 0) {
    return fail('No rate is set for this fuel. Ask the owner to set today’s price first.');
  }
  if (closing < opening) {
    return fail('The closing reading is lower than the opening reading.');
  }

  // Credit slips arrive as JSON from the form component.
  let creditLines = [];
  const rawLines = text(formData, 'credit_lines');
  if (rawLines) {
    try {
      creditLines = JSON.parse(rawLines);
    } catch {
      return fail('The credit slips could not be read. Please re-enter them.');
    }
  }

  if (!Array.isArray(creditLines)) creditLines = [];

  const cleanedLines = [];
  for (const line of creditLines) {
    const customerId = String(line?.customer_id ?? '').trim();
    const litres = Number(line?.litres);
    const amount = Number(line?.amount);

    if (!customerId) return fail('Every credit slip needs a customer.');
    if (!Number.isFinite(litres) || litres <= 0) {
      return fail('Every credit slip needs a litres figure above zero.');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail('Every credit slip needs an amount above zero.');
    }

    cleanedLines.push({
      customer_id: customerId,
      litres: roundMoney(litres),
      amount: roundMoney(amount),
    });
  }

  const litresSold = roundMoney(closing - opening);
  const saleAmount = roundMoney(litresSold * rate);
  const creditTotal = roundMoney(
    cleanedLines.reduce((total, line) => total + line.amount, 0),
  );
  const cashAmount = roundMoney(saleAmount - creditTotal);

  if (cashAmount < 0) {
    return fail(
      `The credit slips come to Rs ${creditTotal.toLocaleString()}, which is more than the ` +
        `Rs ${saleAmount.toLocaleString()} sold on this nozzle. Check the slips.`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_nozzle_reading', {
    p_nozzle_id: nozzleId,
    p_reading_date: readingDate,
    p_opening: opening,
    p_closing: closing,
    p_rate: rate,
    p_cash: cashAmount,
    p_credit_lines: cleanedLines,
  });

  if (error) return fail(describe(error, 'Could not save the reading.'));

  revalidatePath('/admin/readings');
  revalidatePath('/admin');
  revalidatePath('/admin/customers');

  return ok(
    cleanedLines.length > 0
      ? `Saved. ${litresSold} L sold, with ${cleanedLines.length} credit slip${
          cleanedLines.length === 1 ? '' : 's'
        } posted to the ledger.`
      : `Saved. ${litresSold} L sold, all cash.`,
  );
}

/**
 * Removing a reading is a super_admin-only correction. It will be refused if
 * its credit slips have already reached the ledger - that debt has to be
 * cancelled with an offsetting entry first, so the history stays intact.
 */
export async function deleteReading(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const readingId = text(formData, 'reading_id');
  if (!readingId) return fail('Missing the reading.');

  // Goes through delete_reading() rather than deleting the row directly. That
  // function posts an offsetting ledger entry for every credit slip it takes
  // away, in the same transaction. Deleting the row straight would remove the
  // slip but leave the customer's debit standing, so they would appear to owe
  // money for fuel the books no longer show them taking.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_reading', { p_reading_id: readingId });

  if (error) return fail(describe(error, 'Could not delete the reading.'));

  revalidatePath('/admin/readings');
  revalidatePath('/admin');
  revalidatePath('/admin/customers');

  const reversed = Number(data?.slips_reversed ?? 0);
  return ok(
    reversed > 0
      ? `Reading deleted. ${reversed} credit ${reversed === 1 ? 'slip' : 'slips'} reversed on the customer ledger.`
      : 'Reading deleted.',
  );
}

/**
 * Wipes one day's nozzle entries so the day can be entered again.
 *
 * The mistake this fixes is ordinary: a day entered against the wrong date, or
 * six nozzles typed in before anyone noticed the figures were yesterday's. Left
 * alone it poisons everything downstream, because each day's opening comes from
 * the day before.
 *
 * Scope is deliberately just the nozzle entries and their credit slips. Fuel
 * deliveries, stock checks and expenses are deleted one at a time on their own
 * screens, where you can see what you are removing.
 *
 * Credit slips are reversed, not erased - clear_day posts an offsetting entry
 * for each one, so a customer's balance comes back to correct while the history
 * of what happened stays readable.
 */
export async function clearDay(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const date = text(formData, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Missing the date.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('clear_day', { p_date: date });

  if (error) return fail(describe(error, 'Could not clear the day.'));

  revalidatePath('/admin/readings');
  revalidatePath('/admin');
  revalidatePath('/admin/customers');
  revalidatePath('/admin/reports');

  const cleared = Number(data?.readings ?? 0);
  const reversed = Number(data?.slips_reversed ?? 0);

  if (cleared === 0) return ok('There was nothing entered for that day.');

  return ok(
    reversed > 0
      ? `Cleared ${cleared} nozzle ${cleared === 1 ? 'entry' : 'entries'}, and reversed ${reversed} credit ${reversed === 1 ? 'slip' : 'slips'} on the customer ledger.`
      : `Cleared ${cleared} nozzle ${cleared === 1 ? 'entry' : 'entries'}. Enter the day again when ready.`,
  );
}

/**
 * Empties the books completely. Testing scaffolding, not a feature.
 *
 * Three separate things have to be true for this to run: ALLOW_FULL_RESET must
 * be set on the server, the caller must be the owner, and they must type their
 * own password and the word RESET. The environment variable is the important
 * one - deleting it in Vercel retires this permanently without touching code,
 * which is how it is meant to end.
 */
export async function resetEverything(_prevState, formData) {
  if (!fullResetAllowed()) {
    return fail('Resetting everything is switched off on this deployment.');
  }

  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const password = String(formData.get('owner_password') ?? '');
  const confirmation = text(formData, 'confirmation');

  if (confirmation !== 'RESET') return fail('Type RESET in capitals to confirm.');
  if (!password) return fail('Enter your own password to confirm.');
  if (!profile.email) return fail('Could not read your email address. Sign in again and retry.');

  const checkClient = createPasswordCheckClient();
  const { error: checkError } = await checkClient.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (checkError) {
    if (checkError.status === 400 || checkError.code === 'invalid_credentials') {
      return fail('That is not your password. Nothing has been deleted.');
    }
    return fail('Could not reach the server just now. Nothing has been deleted.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reset_all_data');

  if (error) return fail(describe(error, 'Could not reset the data.'));

  ['/admin', '/admin/readings', '/admin/purchases', '/admin/stock-checks',
   '/admin/customers', '/admin/lubricants', '/admin/expenses', '/admin/reports',
   '/admin/settings'].forEach(revalidatePath);

  const n = (key) => Number(data?.[key] ?? 0);
  return ok(
    `Everything cleared: ${n('readings')} readings, ${n('customers')} customers, ` +
      `${n('purchases')} deliveries, ${n('lubricant_sales')} lubricant sales, ` +
      `${n('expenses')} expenses. Logins, tanks, nozzle starting readings and the ` +
      'lubricant product list were kept.',
  );
}

// ---------------------------------------------------------------------------
// Fuel purchases
// ---------------------------------------------------------------------------

export async function createPurchase(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const tankId = text(formData, 'tank_id');
  const purchaseDate = text(formData, 'purchase_date');
  const quantity = number(formData, 'quantity_litres');
  const totalCost = number(formData, 'total_cost');
  const supplierName = text(formData, 'supplier_name');
  const invoiceNumber = text(formData, 'invoice_number');
  const paymentStatus = text(formData, 'payment_status') || 'pending';

  if (!tankId) return fail('Choose which tank the fuel went into.');
  if (!purchaseDate) return fail('Enter the delivery date.');
  if (quantity === null || quantity <= 0) return fail('Enter how many litres were delivered.');
  if (totalCost === null || totalCost <= 0) return fail('Enter the amount on the delivery note.');
  if (!supplierName) return fail('Enter the supplier or OMC name.');
  if (!['paid', 'pending'].includes(paymentStatus)) return fail('Invalid payment status.');

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_purchases').insert({
    tank_id: tankId,
    purchase_date: purchaseDate,
    quantity_litres: quantity,
    // The amount on the note is what gets stored; the rate per litre is a
    // generated column derived from it - see migration 023.
    total_cost: roundMoney(totalCost),
    supplier_name: supplierName,
    invoice_number: invoiceNumber || null,
    payment_status: paymentStatus,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the purchase.'));

  revalidatePath('/admin/purchases');
  revalidatePath('/admin');
  revalidatePath('/admin/stock-checks');

  return ok(`Saved. ${quantity} L added to stock.`);
}

/*
 * Fuel and lubricant purchases sit in one list on screen, so the two actions
 * below serve both. `kind` says which table the row came from; anything other
 * than 'lubricant' is treated as fuel, so an old form that never sent the field
 * keeps working.
 */
const PURCHASE_TABLES = {
  fuel: { table: 'fuel_purchases', noun: 'delivery' },
  lubricant: { table: 'lubricant_purchases', noun: 'lubricant purchase' },
};

const purchaseTable = (formData) =>
  PURCHASE_TABLES[text(formData, 'kind')] ?? PURCHASE_TABLES.fuel;

/**
 * Removes a purchase. Owner only, and the way to correct a mistyped quantity -
 * delete the wrong one and record it again, rather than leaving stock carrying
 * something that never arrived. Stock is recalculated by trigger either way.
 */
export async function deletePurchase(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const purchaseId = text(formData, 'purchase_id');
  const { table, noun } = purchaseTable(formData);
  if (!purchaseId) return fail(`Missing the ${noun}.`);

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq('id', purchaseId);

  if (error) return fail(describe(error, `Could not delete the ${noun}.`));

  revalidatePath('/admin/purchases');
  revalidatePath('/admin');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin/lubricants');
  return ok(
    noun === 'delivery'
      ? 'Delivery deleted. Tank stock has been recalculated.'
      : 'Purchase deleted. Lubricant stock has been recalculated.',
  );
}

export async function setPurchasePaymentStatus(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const purchaseId = text(formData, 'purchase_id');
  const paymentStatus = text(formData, 'payment_status');
  const { table } = purchaseTable(formData);

  if (!purchaseId) return fail('Missing the purchase.');
  if (!['paid', 'pending'].includes(paymentStatus)) return fail('Invalid payment status.');

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ payment_status: paymentStatus })
    .eq('id', purchaseId);

  if (error) return fail(describe(error, 'Could not update the purchase.'));

  revalidatePath('/admin/purchases');
  return ok(paymentStatus === 'paid' ? 'Marked as paid.' : 'Marked as pending.');
}

// ---------------------------------------------------------------------------
// Lubricants
//
// Three things live here: the product list, stock coming in from the
// distributor, and sales over the counter.
//
// Who may do what follows the same line as everywhere else. Recording a sale or
// a delivery is daily work, so staff do both. The product list is
// configuration - which brands are stocked, what they are priced at, what was
// on the shelf to begin with - so it belongs to the owner, like the tanks.
// ---------------------------------------------------------------------------

/** Litres, rounded the way Postgres rounds them. Two decimals fits 0.25 L. */
const roundLitres = (value) => roundMoney(value);

export async function createLubricant(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const name = text(formData, 'name');
  const packSize = number(formData, 'pack_size_litres');
  const saleRate = number(formData, 'sale_rate_per_litre');
  const openingStock = number(formData, 'opening_stock_litres');
  const openingDate = text(formData, 'opening_stock_date');

  if (!name) return fail('Enter the lubricant’s name.');
  if (packSize === null || packSize <= 0) return fail('Enter the pack size in litres.');
  if (saleRate !== null && saleRate <= 0) return fail('The selling rate must be above zero.');
  if (openingStock !== null && openingStock < 0) {
    return fail('The opening stock cannot be negative.');
  }
  if (!openingDate) return fail('Enter the date the opening stock counts from.');

  const supabase = await createClient();
  const { error } = await supabase.from('lubricants').insert({
    name,
    pack_size_litres: packSize,
    sale_rate_per_litre: saleRate,
    opening_stock_litres: openingStock ?? 0,
    opening_stock_date: openingDate,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not add the lubricant.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin/purchases');
  return ok(`${name} added. It can be sold and restocked from now on.`);
}

export async function updateLubricant(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const lubricantId = text(formData, 'lubricant_id');
  const name = text(formData, 'name');
  const packSize = number(formData, 'pack_size_litres');
  const saleRate = number(formData, 'sale_rate_per_litre');
  const openingStock = number(formData, 'opening_stock_litres');
  const openingDate = text(formData, 'opening_stock_date');

  if (!lubricantId) return fail('Missing the lubricant.');
  if (!name) return fail('Enter the lubricant’s name.');
  if (packSize === null || packSize <= 0) return fail('Enter the pack size in litres.');
  if (saleRate !== null && saleRate <= 0) return fail('The selling rate must be above zero.');
  if (openingStock === null || openingStock < 0) return fail('Enter the opening stock.');
  if (!openingDate) return fail('Enter the date the opening stock counts from.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('lubricants')
    .update({
      name,
      pack_size_litres: packSize,
      sale_rate_per_litre: saleRate,
      opening_stock_litres: openingStock,
      opening_stock_date: openingDate,
    })
    .eq('id', lubricantId);

  if (error) return fail(describe(error, 'Could not update the lubricant.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin');
  return ok(`${name} updated.`);
}

/**
 * Removes a lubricant from the shelf.
 *
 * The database decides which of the two possible meanings applies: a product
 * that was never bought or sold is deleted outright, while one with history is
 * retired so the months it appears in keep adding up. The message says which
 * happened rather than leaving the owner to work it out - see delete_lubricant
 * in migration 024.
 */
export async function deleteLubricant(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const lubricantId = text(formData, 'lubricant_id');
  if (!lubricantId) return fail('Missing the lubricant.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_lubricant', {
    p_lubricant_id: lubricantId,
  });

  if (error) return fail(describe(error, 'Could not remove the lubricant.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin/purchases');
  revalidatePath('/admin');

  const name = data?.name ?? 'The lubricant';

  if (data?.removed) return ok(`${name} removed. It was never bought or sold.`);

  return ok(
    `${name} retired. It will not appear on the sale form again, and its past ` +
      'sales and purchases stay on the books.',
  );
}

/** Puts a retired product back on the shelf. */
export async function setLubricantActive(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const lubricantId = text(formData, 'lubricant_id');
  const isActive = text(formData, 'is_active') === 'true';

  if (!lubricantId) return fail('Missing the lubricant.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('lubricants')
    .update({ is_active: isActive })
    .eq('id', lubricantId);

  if (error) return fail(describe(error, 'Could not update the lubricant.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  return ok(isActive ? 'Back on the shelf.' : 'Retired.');
}

/**
 * Stock in from the distributor. Same shape as a fuel delivery, and the same
 * rule about which figure is the fact: the invoice total is typed and the rate
 * per litre is derived from it.
 */
export async function createLubricantPurchase(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const lubricantId = text(formData, 'lubricant_id');
  const purchaseDate = text(formData, 'purchase_date');
  const quantity = number(formData, 'quantity_litres');
  const totalCost = number(formData, 'total_cost');
  const supplierName = text(formData, 'supplier_name');
  const invoiceNumber = text(formData, 'invoice_number');
  const paymentStatus = text(formData, 'payment_status') || 'pending';

  if (!lubricantId) return fail('Choose which lubricant was delivered.');
  if (!purchaseDate) return fail('Enter the delivery date.');
  if (quantity === null || quantity <= 0) return fail('Enter how many litres were delivered.');
  if (totalCost === null || totalCost <= 0) return fail('Enter the amount on the invoice.');
  if (!supplierName) return fail('Enter the supplier name.');
  if (!['paid', 'pending'].includes(paymentStatus)) return fail('Invalid payment status.');

  const supabase = await createClient();
  const { error } = await supabase.from('lubricant_purchases').insert({
    lubricant_id: lubricantId,
    purchase_date: purchaseDate,
    quantity_litres: roundLitres(quantity),
    total_cost: roundMoney(totalCost),
    supplier_name: supplierName,
    invoice_number: invoiceNumber || null,
    payment_status: paymentStatus,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the purchase.'));

  revalidatePath('/admin/purchases');
  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin');

  return ok(`Saved. ${formatLitres(quantity)} added to the shelf.`);
}

/**
 * One sale over the counter.
 *
 * Cash is derived here - amount minus whatever was put on credit - rather than
 * taken from the form, for the same reason it is on the reading screen: cash
 * should never be able to be quietly wrong. A sale with any credit on it must
 * name the customer, and the database refuses it otherwise.
 */
export async function createLubricantSale(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const lubricantId = text(formData, 'lubricant_id');
  const saleDate = text(formData, 'sale_date');
  const litres = number(formData, 'litres');
  const amount = number(formData, 'amount');
  const creditAmount = number(formData, 'credit_amount') ?? 0;
  const customerId = text(formData, 'customer_id');
  const note = text(formData, 'note');

  if (!lubricantId) return fail('Choose which lubricant was sold.');
  if (!saleDate) return fail('Missing the date.');
  if (litres === null || litres <= 0) return fail('Enter how many litres were sold.');
  if (amount === null || amount <= 0) return fail('Enter what the customer was charged.');
  if (creditAmount < 0) return fail('The credit amount cannot be negative.');

  const total = roundMoney(amount);
  const credit = roundMoney(creditAmount);

  if (credit > total) {
    return fail('The amount on credit is more than the sale itself. Check the figures.');
  }
  if (credit > 0 && !customerId) {
    return fail('Choose the customer this was given to on credit.');
  }

  const cash = roundMoney(total - credit);

  const supabase = await createClient();
  const { error } = await supabase.from('lubricant_sales').insert({
    lubricant_id: lubricantId,
    sale_date: saleDate,
    litres: roundLitres(litres),
    amount: total,
    cash_amount: cash,
    credit_amount: credit,
    // A cash sale may still name the customer, but only a credit sale needs to.
    customer_id: customerId || null,
    note: note || null,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the sale.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin');
  if (credit > 0) revalidatePath('/admin/customers');

  return ok(
    credit > 0
      ? `Saved. ${formatLitres(litres)} sold, ${formatPKR(credit)} of it on credit and posted to the ledger.`
      : `Saved. ${formatLitres(litres)} sold for cash.`,
  );
}

/**
 * Removes a sale. Owner only, like deleting a nozzle reading, and for the same
 * reason: the credit on it has already moved a customer's balance. The database
 * posts the offsetting entry before the row goes, so the ledger keeps showing
 * both what happened and what undid it.
 */
export async function deleteLubricantSale(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const saleId = text(formData, 'sale_id');
  if (!saleId) return fail('Missing the sale.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_lubricant_sale', { p_sale_id: saleId });

  if (error) return fail(describe(error, 'Could not delete the sale.'));

  revalidatePath('/admin/lubricants');
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin/customers');
  revalidatePath('/admin');

  return ok(
    data?.credit_reversed
      ? 'Sale deleted, and the credit on it reversed on the customer’s ledger.'
      : 'Sale deleted. Stock has been recalculated.',
  );
}

// ---------------------------------------------------------------------------
// Stock checks (the physical dip)
// ---------------------------------------------------------------------------

export async function createStockCheck(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const tankId = text(formData, 'tank_id');
  const checkDate = text(formData, 'check_date');
  const actualDip = number(formData, 'actual_dip_reading');
  const note = text(formData, 'note');

  if (!tankId) return fail('Choose a tank.');
  if (!checkDate) return fail('Enter the date of the dip.');
  if (actualDip === null || actualDip < 0) return fail('Enter the measured dip reading.');

  const supabase = await createClient();

  // Expected stock is worked out by the database, never sent from the browser -
  // otherwise the gain/loss figure could be made to say anything.
  const { data: expected, error: expectedError } = await supabase.rpc(
    'calculate_expected_stock',
    { p_tank_id: tankId, p_date: checkDate },
  );

  if (expectedError) {
    return fail(describe(expectedError, 'Could not work out the expected stock.'));
  }

  const { error } = await supabase.from('stock_checks').insert({
    tank_id: tankId,
    check_date: checkDate,
    expected_stock: expected ?? 0,
    actual_dip_reading: actualDip,
    note: note || null,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the stock check.'));

  const difference = roundMoney(actualDip - Number(expected ?? 0));
  revalidatePath('/admin/stock-checks');
  revalidatePath('/admin');

  if (difference === 0) return ok('Saved. Stock matches the books exactly.');
  return ok(
    difference > 0
      ? `Saved. Gain of ${difference} L against the books.`
      : `Saved. Loss of ${Math.abs(difference)} L against the books.`,
  );
}

// ---------------------------------------------------------------------------
// Customers and the ledger
// ---------------------------------------------------------------------------

export async function createCustomer(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const name = text(formData, 'name');
  const vehicleNumber = text(formData, 'vehicle_number');
  const phone = text(formData, 'phone');
  const creditLimit = number(formData, 'credit_limit');

  if (!name) return fail('Enter the customer’s name.');
  if (creditLimit !== null && creditLimit < 0) return fail('The credit limit cannot be negative.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      vehicle_number: vehicleNumber || null,
      phone: phone || null,
      credit_limit: creditLimit,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return fail(describe(error, 'Could not create the customer.'));

  revalidatePath('/admin/customers');
  redirect(`/admin/customers/${data.id}`);
}

/**
 * Records a payment from a customer, reducing what they owe.
 *
 * This is an ordinary append to the ledger. Fuel taken on credit gets there by
 * itself, from the reading screen - it is never typed in here.
 */
export async function recordPayment(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  } catch (error) {
    return fail(error.message);
  }

  const customerId = text(formData, 'customer_id');
  const amount = number(formData, 'amount');
  const entryDate = text(formData, 'entry_date');
  const note = text(formData, 'note');

  if (!customerId) return fail('Missing the customer.');
  if (amount === null || amount <= 0) return fail('Enter how much they paid.');
  if (!entryDate) return fail('Enter the date of the payment.');

  const supabase = await createClient();
  const { error } = await supabase.from('ledger_entries').insert({
    customer_id: customerId,
    entry_type: 'credit',
    amount,
    entry_date: entryDate,
    note: note || 'Payment received',
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not record the payment.'));

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');
  return ok('Payment recorded.');
}

/**
 * A manual correction to the ledger - an opening balance carried over from the
 * old register, or an entry that cancels out an earlier mistake.
 *
 * Nothing is ever edited or deleted: a correction is a new entry pointing the
 * other way, which is what keeps the ledger auditable.
 */
export async function recordLedgerAdjustment(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const customerId = text(formData, 'customer_id');
  const entryType = text(formData, 'entry_type');
  const amount = number(formData, 'amount');
  const entryDate = text(formData, 'entry_date');
  const note = text(formData, 'note');

  if (!customerId) return fail('Missing the customer.');
  if (!['debit', 'credit'].includes(entryType)) return fail('Choose whether this adds or reduces what they owe.');
  if (amount === null || amount <= 0) return fail('Enter an amount above zero.');
  if (!entryDate) return fail('Enter a date.');
  if (!note) return fail('Write a note explaining this adjustment - it stays on the record permanently.');

  const supabase = await createClient();
  const { error } = await supabase.from('ledger_entries').insert({
    customer_id: customerId,
    entry_type: entryType,
    amount,
    entry_date: entryDate,
    note,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not record the adjustment.'));

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');
  return ok('Adjustment recorded.');
}

// ---------------------------------------------------------------------------
// Configuration - super_admin only
// ---------------------------------------------------------------------------

export async function setFuelPrice(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const fuelType = text(formData, 'fuel_type');
  const rate = number(formData, 'rate');
  const effectiveFrom = text(formData, 'effective_from');

  if (!['petrol', 'diesel'].includes(fuelType)) return fail('Choose petrol or diesel.');
  if (rate === null || rate <= 0) return fail('Enter a rate above zero.');
  if (!effectiveFrom) return fail('Enter the date this rate starts from.');

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_prices').insert({
    fuel_type: fuelType,
    rate,
    effective_from: effectiveFrom,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the rate.'));

  revalidatePath('/admin/settings');
  revalidatePath('/admin/readings');
  return ok(`${fuelType === 'petrol' ? 'Petrol' : 'Diesel'} rate set to ${formatRate(rate)} per litre.`);
}

/**
 * Removes a rate. Owner only, and the only way to correct a mistyped one.
 *
 * A fuel and a date can carry one rate, enforced by a unique constraint - so
 * typing 339.48 when you meant 393.48 cannot be fixed by saving again over the
 * top. Without this the wrong price stands for the whole day and every reading
 * entered against it is wrong.
 *
 * WHAT IT DOES NOT UNDO. Readings already saved keep the rate they were sold
 * at - a copy sits on the reading row itself, which is what stops a later price
 * change quietly rewriting last week's takings. So removing a rate fixes what
 * is entered from here on and leaves what is already entered alone; those days
 * have to be cleared and re-entered. The button says so before it acts.
 */
export async function deleteFuelPrice(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const priceId = text(formData, 'price_id');
  if (!priceId) return fail('Missing the rate.');

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_prices').delete().eq('id', priceId);

  if (error) return fail(describe(error, 'Could not remove the rate.'));

  revalidatePath('/admin/settings');
  revalidatePath('/admin/readings');
  revalidatePath('/admin');
  return ok('Rate removed. Set the correct one now.');
}

/**
 * All six nozzles at once - how the pump is plumbed, saved as one thing.
 *
 * Describing the wiring is a single job done once when the pump goes onto the
 * system, so it gets one button rather than six. The rows arrive as three
 * parallel lists because a form serialises repeated field names in the order
 * they appear in the markup, which is what lines index 2 of one list up with
 * index 2 of the next.
 *
 * Everything is validated before anything is sent: a half-valid submission
 * should be refused whole, not applied as far as the first bad row. The write
 * itself is one UPDATE inside set_nozzle_wiring() for the same reason - see
 * migration 022.
 */
export async function setNozzleWiring(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const ids = formData.getAll('nozzle_id').map((value) => String(value));
  const tankIds = formData.getAll('tank_id').map((value) => String(value));
  const readings = formData.getAll('starting_reading').map((value) => String(value));

  if (ids.length === 0) return fail('Nothing to save.');
  if (ids.length !== tankIds.length || ids.length !== readings.length) {
    return fail('That form arrived incomplete. Reopen it and try again.');
  }

  const rows = [];
  for (let index = 0; index < ids.length; index += 1) {
    const startingReading = Number(readings[index]);

    if (!ids[index] || !tankIds[index]) {
      return fail('Every nozzle needs a tank. Check the list and try again.');
    }
    if (readings[index].trim() === '' || !Number.isFinite(startingReading)) {
      return fail('Every nozzle needs a starting meter reading, even if it is 0.');
    }
    if (startingReading < 0) {
      return fail('A meter reading cannot be negative.');
    }

    rows.push({
      nozzle_id: ids[index],
      tank_id: tankIds[index],
      starting_reading: roundMoney(startingReading),
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_nozzle_wiring', { p_rows: rows });

  if (error) return fail(describe(error, 'Could not save the nozzle wiring.'));

  revalidatePath('/admin/settings');
  revalidatePath('/admin/readings');
  revalidatePath('/admin');

  const saved = Number(data ?? rows.length);
  return ok(`Saved. ${saved} ${saved === 1 ? 'nozzle' : 'nozzles'} updated.`);
}

export async function updateTank(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const tankId = text(formData, 'tank_id');
  const capacity = number(formData, 'capacity_litres');
  const openingStock = number(formData, 'opening_stock_litres');
  const openingStockDate = text(formData, 'opening_stock_date');

  if (!tankId) return fail('Missing the tank.');
  if (capacity === null || capacity <= 0) return fail('Enter the tank capacity.');
  if (openingStock === null || openingStock < 0) return fail('Enter the opening stock.');
  if (!openingStockDate) return fail('Enter the date the opening stock applies from.');

  // A tank cannot hold more than it holds. Worth refusing rather than warning:
  // opening stock is what every later litre is measured against, so a figure
  // above capacity quietly overstates the stock on hand from that day onward,
  // and the dashboard reads as fuel that was never in the ground.
  if (openingStock > capacity) {
    return fail(
      `Opening stock cannot be more than the tank holds. ` +
        `This tank holds ${formatLitres(capacity)} and you entered ${formatLitres(openingStock)}. ` +
        `Raise the capacity if the tank really is bigger.`,
    );
  }

  const supabase = await createClient();

  // Same rule as the nozzles: read first, write only if it would change
  // something.
  const { data: current, error: readError } = await supabase
    .from('tanks')
    .select('capacity_litres, opening_stock_litres, opening_stock_date')
    .eq('id', tankId)
    .single();

  if (readError) return fail(describe(readError, 'Could not read the tank.'));

  if (
    Number(current.capacity_litres) === capacity &&
    Number(current.opening_stock_litres) === openingStock &&
    current.opening_stock_date === openingStockDate
  ) {
    return ok('No change - this tank is already set that way.');
  }

  const { error } = await supabase
    .from('tanks')
    .update({
      capacity_litres: capacity,
      opening_stock_litres: openingStock,
      opening_stock_date: openingStockDate,
    })
    .eq('id', tankId);

  if (error) return fail(describe(error, 'Could not update the tank.'));

  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  return ok('Tank updated.');
}

export async function createExpense(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const category = text(formData, 'category');
  const amount = number(formData, 'amount');
  const expenseDate = text(formData, 'expense_date');
  const note = text(formData, 'note');

  if (!category) return fail('Enter a category.');
  if (amount === null || amount <= 0) return fail('Enter an amount above zero.');
  if (!expenseDate) return fail('Enter the date.');

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').insert({
    category,
    amount,
    expense_date: expenseDate,
    note: note || null,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not save the expense.'));

  // Reports too: its Expenses total and the profit below it both move.
  revalidatePath('/admin/expenses');
  revalidatePath('/admin/reports');
  return ok('Expense recorded.');
}

/**
 * Removes an expense. Owner only - and the way to fix a mistyped amount, since
 * an expense feeds the profit figure and a wrong one quietly distorts it.
 */
export async function deleteExpense(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const expenseId = text(formData, 'expense_id');
  if (!expenseId) return fail('Missing the expense.');

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);

  if (error) return fail(describe(error, 'Could not delete the expense.'));

  revalidatePath('/admin/expenses');
  revalidatePath('/admin/reports');
  return ok('Expense deleted.');
}

// ---------------------------------------------------------------------------
// Staff accounts - super_admin only
//
// There is no public signup. Every login is created here, which is the only
// place the service-role key is used.
// ---------------------------------------------------------------------------

export async function createStaffAccount(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const email = text(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const fullName = text(formData, 'full_name');
  const role = text(formData, 'role');

  if (!email) return fail('Enter an email address.');
  if (password.length < 8) return fail('The password must be at least 8 characters.');
  if (!fullName) return fail('Enter the person’s name.');
  if (![ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY].includes(role)) return fail('Choose a role.');

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    return fail(describe(createError, 'Could not create the account.'));
  }

  // The trigger on auth.users always creates the profile as data_entry, so the
  // role is set deliberately here, after the super_admin check above.
  const { error: roleError } = await admin
    .from('profiles')
    .update({ role, full_name: fullName })
    .eq('id', created.user.id);

  if (roleError) {
    return fail(
      `The login was created but the role could not be set (${roleError.message}). ` +
        'Set it from the staff list.',
    );
  }

  revalidatePath('/admin/settings');
  return ok(`${fullName} can now sign in.`);
}

export async function setStaffRole(_prevState, formData) {
  const actor = await requireRoleOrFail(ROLES.SUPER_ADMIN);
  if (actor.error) return actor.error;

  const profileId = text(formData, 'profile_id');
  const role = text(formData, 'role');

  if (!profileId) return fail('Missing the account.');
  if (![ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY].includes(role)) return fail('Choose a role.');
  if (profileId === actor.profile.id) {
    return fail('You cannot change your own role - ask the other owner account to do it.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);

  if (error) return fail(describe(error, 'Could not change the role.'));

  revalidatePath('/admin/settings');
  return ok('Role updated.');
}

export async function setStaffActive(_prevState, formData) {
  const actor = await requireRoleOrFail(ROLES.SUPER_ADMIN);
  if (actor.error) return actor.error;

  const profileId = text(formData, 'profile_id');
  const isActive = text(formData, 'is_active') === 'true';

  if (!profileId) return fail('Missing the account.');
  if (profileId === actor.profile.id) {
    return fail('You cannot deactivate your own account.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId);

  if (error) return fail(describe(error, 'Could not update the account.'));

  revalidatePath('/admin/settings');
  return ok(isActive ? 'Account re-enabled.' : 'Account deactivated.');
}

/**
 * Deletes a login for good. Owner only, and the owner's own password is
 * required to go through with it.
 *
 * Why the password. Deactivating is reversible; this is not. The realistic
 * risk is not an attacker, it is the phone left unlocked on the desk in the
 * office - so the one thing an onlooker does not have is asked for.
 *
 * WHAT SURVIVES. The readings, deliveries, expenses and ledger entries this
 * person recorded all stay exactly as they are; only the "recorded by" name
 * against them becomes blank, because the account it pointed at is gone. No
 * money figure moves. Migration 011 is what makes that possible on the ledger,
 * whose append-only trigger would otherwise refuse the change.
 *
 * Deactivating remains the better default and the UI says so - this is for
 * accounts created by mistake, or people who were never really staff.
 */
export async function deleteStaffAccount(_prevState, formData) {
  const actor = await requireRoleOrFail(ROLES.SUPER_ADMIN);
  if (actor.error) return actor.error;

  const profileId = text(formData, 'profile_id');
  const ownerPassword = String(formData.get('owner_password') ?? '');

  if (!profileId) return fail('Missing the account.');
  if (profileId === actor.profile.id) {
    return fail('You cannot delete your own account.');
  }
  if (!ownerPassword) return fail('Enter your own password to confirm.');
  if (!actor.profile.email) {
    return fail('Could not read your email address. Sign out and in again, then retry.');
  }

  // Same throwaway-client trick as the password change: confirm it is really
  // the owner at the keyboard, without disturbing the session doing the work.
  const checkClient = createPasswordCheckClient();
  const { error: checkError } = await checkClient.auth.signInWithPassword({
    email: actor.profile.email,
    password: ownerPassword,
  });

  if (checkError) {
    if (checkError.status === 400 || checkError.code === 'invalid_credentials') {
      return fail('That is not your password. The account has not been deleted.');
    }
    return fail('Could not reach the server just now. Nothing has been deleted.');
  }

  // Deleting the auth user cascades to the profile, which in turn blanks the
  // created_by on everything they recorded. The rows themselves stay.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profileId);

  if (error) return fail(describe(error, 'Could not delete the account.'));

  revalidatePath('/admin/settings');
  return ok('Account deleted. What they recorded has been kept.');
}

/** requireRole, but returning the failure instead of throwing. */
async function requireRoleOrFail(...roles) {
  try {
    return { profile: await requireRole(...roles) };
  } catch (error) {
    return { error: fail(error.message) };
  }
}

// ---------------------------------------------------------------------------
// Banking
//
// The owner's own accounts. Every one of these is super_admin only, and the
// RLS policies say the same thing independently.
// ---------------------------------------------------------------------------

export async function createBankAccount(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const bankName = text(formData, 'bank_name');
  const label = text(formData, 'account_label');
  const accountNumber = text(formData, 'account_number');
  const openingBalance = number(formData, 'opening_balance') ?? 0;

  if (!bankName) return fail('Enter the bank name.');
  if (!label) return fail('Give the account a short name, so you can tell the two apart.');
  if (!Number.isFinite(openingBalance)) return fail('Enter the balance as a number.');

  const supabase = await createClient();
  const { error } = await supabase.from('bank_accounts').insert({
    bank_name: bankName,
    account_label: label,
    account_number: accountNumber || null,
    opening_balance: roundMoney(openingBalance),
  });

  if (error) return fail(describe(error, 'Could not add the account.'));

  revalidatePath('/admin/banking');
  return ok(`${label} added.`);
}

/**
 * Removes an account and everything recorded against it.
 *
 * Hard delete, on purpose: this is for an account added by mistake or one that
 * has been closed. The transactions go with it, which is why the button asks
 * first and says how many will go.
 */
export async function deleteBankAccount(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const accountId = text(formData, 'account_id');
  if (!accountId) return fail('Missing the account.');

  const supabase = await createClient();
  const { error } = await supabase.from('bank_accounts').delete().eq('id', accountId);

  if (error) return fail(describe(error, 'Could not delete the account.'));

  revalidatePath('/admin/banking');
  return ok('Account removed.');
}

/**
 * Records money in or out.
 *
 * Nothing here maintains a balance column - the balance is derived from these
 * rows and the account's carried figures every time it is read, so it cannot
 * drift away from the transactions that produced it. Same principle the tank
 * stock already follows.
 */
export async function createBankTransaction(_prevState, formData) {
  let profile;
  try {
    profile = await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const accountId = text(formData, 'account_id');
  const txnType = text(formData, 'txn_type');
  const amount = number(formData, 'amount');
  const txnDate = text(formData, 'txn_date');
  const category = text(formData, 'category');
  const note = text(formData, 'note');

  if (!accountId) return fail('Choose which account.');
  if (txnType !== 'deposit' && txnType !== 'payment') return fail('Choose money in or money out.');
  if (amount === null || amount <= 0) return fail('Enter an amount above zero.');
  if (!txnDate) return fail('Enter the date.');

  const supabase = await createClient();

  // A payment goes through the RPC, never a plain insert. It may have to come
  // out of more than one account, and several inserts that are really one
  // payment must land together or not at all - which only the database can
  // promise. It also works the split out from the balances as they actually
  // are, so the figures the browser posted are a suggestion, not the decision.
  if (txnType === 'payment') {
    const coverIds = formData
      .getAll('cover_account_ids')
      .filter((id) => typeof id === 'string' && id.length > 0 && id !== accountId);

    const { data, error: paymentError } = await supabase.rpc('record_bank_payment', {
      p_account_id: accountId,
      p_amount: roundMoney(amount),
      p_date: txnDate,
      p_category: category || null,
      p_note: note || null,
      p_cover_ids: coverIds,
    });

    if (paymentError) return fail(describe(paymentError, 'Could not record the payment.'));

    revalidatePath('/admin/banking');
    return ok(data?.message ?? 'Payment recorded.');
  }

  const { error } = await supabase.from('bank_transactions').insert({
    account_id: accountId,
    txn_type: 'deposit',
    amount: roundMoney(amount),
    txn_date: txnDate,
    // A category says something about a payment and nothing about a deposit.
    category: null,
    note: note || null,
    created_by: profile.id,
  });

  if (error) return fail(describe(error, 'Could not record the deposit.'));

  revalidatePath('/admin/banking');
  return ok('Deposit recorded.');
}

export async function deleteBankTransaction(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const txnId = text(formData, 'transaction_id');
  if (!txnId) return fail('Missing the transaction.');

  const supabase = await createClient();
  const { error } = await supabase.from('bank_transactions').delete().eq('id', txnId);

  if (error) return fail(describe(error, 'Could not remove the transaction.'));

  revalidatePath('/admin/banking');
  return ok('Transaction removed.');
}
