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
import { createAdminClient } from './supabase-auth';
import { requireRole, ROLES, roundMoney, landingPageFor } from './helpers';

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
    // Deliberately vague: never reveal whether an email exists.
    return fail('Those details did not work. Check your email and password.');
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

  const supabase = await createClient();
  const { error } = await supabase.from('nozzle_readings').delete().eq('id', readingId);

  if (error) {
    if (String(error.message).includes('violates foreign key')) {
      return fail(
        'This reading has credit slips already posted to a customer ledger. Post an ' +
          'offsetting ledger entry instead of deleting it.',
      );
    }
    return fail(describe(error, 'Could not delete the reading.'));
  }

  revalidatePath('/admin/readings');
  revalidatePath('/admin');
  return ok('Reading deleted.');
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
  const rate = number(formData, 'rate');
  const supplierName = text(formData, 'supplier_name');
  const invoiceNumber = text(formData, 'invoice_number');
  const paymentStatus = text(formData, 'payment_status') || 'pending';

  if (!tankId) return fail('Choose which tank the fuel went into.');
  if (!purchaseDate) return fail('Enter the delivery date.');
  if (quantity === null || quantity <= 0) return fail('Enter how many litres were delivered.');
  if (rate === null || rate <= 0) return fail('Enter the rate per litre.');
  if (!supplierName) return fail('Enter the supplier or OMC name.');
  if (!['paid', 'pending'].includes(paymentStatus)) return fail('Invalid payment status.');

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_purchases').insert({
    tank_id: tankId,
    purchase_date: purchaseDate,
    quantity_litres: quantity,
    rate,
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

export async function setPurchasePaymentStatus(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const purchaseId = text(formData, 'purchase_id');
  const paymentStatus = text(formData, 'payment_status');

  if (!purchaseId) return fail('Missing the purchase.');
  if (!['paid', 'pending'].includes(paymentStatus)) return fail('Invalid payment status.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('fuel_purchases')
    .update({ payment_status: paymentStatus })
    .eq('id', purchaseId);

  if (error) return fail(describe(error, 'Could not update the purchase.'));

  revalidatePath('/admin/purchases');
  return ok(paymentStatus === 'paid' ? 'Marked as paid.' : 'Marked as pending.');
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
  return ok(`${fuelType === 'petrol' ? 'Petrol' : 'Diesel'} rate set to Rs ${rate} per litre.`);
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

  const supabase = await createClient();
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

export async function setNozzleTank(_prevState, formData) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return fail(error.message);
  }

  const nozzleId = text(formData, 'nozzle_id');
  const tankId = text(formData, 'tank_id');

  if (!nozzleId || !tankId) return fail('Missing the nozzle or tank.');

  const supabase = await createClient();
  const { error } = await supabase.from('nozzles').update({ tank_id: tankId }).eq('id', nozzleId);

  if (error) return fail(describe(error, 'Could not update the nozzle.'));

  revalidatePath('/admin/settings');
  revalidatePath('/admin/readings');
  return ok('Nozzle updated.');
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

  revalidatePath('/admin/reports');
  return ok('Expense recorded.');
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

/** requireRole, but returning the failure instead of throwing. */
async function requireRoleOrFail(...roles) {
  try {
    return { profile: await requireRole(...roles) };
  } catch (error) {
    return { error: fail(error.message) };
  }
}
