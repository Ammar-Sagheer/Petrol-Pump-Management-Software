/**
 * The statement of account, as a PDF, drawn with pdf-lib.
 *
 * A PDF and not a print stylesheet, because of what happens to this page after
 * it leaves the app. It goes on WhatsApp to a haulier who is not going to come
 * to the office, it gets kept in a folder against the day someone disputes a
 * figure, and only sometimes does it go on paper. A browser print dialog gives
 * you the last of those three reliably and the first two only if the person
 * holding the tablet knows where "Save as PDF" hides.
 *
 * WHY A4 AND WHY HELVETICA. A4 is the paper in every shop in Pakistan that will
 * print this. Helvetica is one of the fourteen fonts every PDF reader has built
 * in, so no font is embedded and none has to be: the drawing itself is a few KB,
 * and it opens the same on a cheap Android phone as on a laptop. Embedding a
 * font to gain a nicer `a` would multiply the size of a file that is mostly sent
 * over patchy mobile data.
 *
 * The file lands around 145KB all the same, and effectively all of it is
 * public/logo.png going in at its full resolution to be drawn 38pt tall. That is
 * one small photo's worth over WhatsApp and not worth a build step to fix - but
 * it is worth knowing where the weight is before anyone goes looking for it in
 * the layout. Drop the logo and the same statement is about 8KB.
 *
 * EVERYTHING IS ASCII, and that is a constraint rather than a preference. The
 * standard fonts are WinAnsi-encoded, and pdf-lib THROWS on a character outside
 * it rather than dropping it - so one en-dash pasted into a customer's name, or
 * a rupee sign, and the download fails instead of looking slightly wrong. The
 * app writes "Rs" everywhere anyway (see formatPKR), and `ascii()` below scrubs
 * the punctuation that a phone keyboard produces without anyone meaning to.
 *
 * THE TYPE IS BIGGER THAN A DESKTOP DOCUMENT'S. Same reason the screens are:
 * this is read in a pump office in poor light, and now also by a customer
 * squinting at a phone. Body text is 9.5pt where a dense financial document
 * would use 7.5, and the figure that matters - what is owed - is 26pt.
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { BUSINESS_NAME } from './brand';
import { formatPKR, formatDate, formatDateLong, formatLitres } from './helpers';

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const CONTENT = A4.width - MARGIN * 2;

/*
 * Pulled from globals.css rather than picked afresh, so a statement in a folder
 * and the screen it came from are recognisably the same document. `brand` is the
 * green on the primary buttons, `ink` the body grey, `due` the red the ledger
 * already uses for money owed.
 */
const COLOR = {
  ink: rgb(0.09, 0.11, 0.13),
  muted: rgb(0.42, 0.45, 0.5),
  faint: rgb(0.62, 0.65, 0.69),
  rule: rgb(0.85, 0.87, 0.89),
  band: rgb(0.96, 0.97, 0.975),
  brand: rgb(0.02, 0.37, 0.24),
  brandTint: rgb(0.93, 0.96, 0.94),
  due: rgb(0.7, 0.11, 0.11),
  dueTint: rgb(0.99, 0.95, 0.95),
};

/**
 * The six columns, and the reason there are only six.
 *
 * Date, what it was, what it cost, what has come off it, what is left, how old.
 * That is the whole argument a statement has to make. Every extra column
 * narrows Detail, and Detail is the one a customer reads to recognise the fill
 * - "Petrol 68.63 L" is what jogs his memory, not the row number.
 */
const COLUMNS = [
  // 76 and not 62, which was measured off "Date" rather than off a date: every
  // row on the first draft read "11 Aug 2..." because the year - the one part of
  // a date that settles an argument about an old fill - was what got cut.
  { key: 'date', label: 'Date', width: 76, align: 'left' },
  { key: 'detail', label: 'Detail', width: 179, align: 'left' },
  { key: 'original', label: 'Amount', width: 78, align: 'right' },
  { key: 'paid', label: 'Paid off', width: 70, align: 'right' },
  { key: 'due', label: 'Still due', width: 78, align: 'right' },
  { key: 'age', label: 'Days', width: 34, align: 'right' },
];

/**
 * Scrub to WinAnsi, because pdf-lib throws on anything else.
 *
 * The curly quotes and dashes are what a phone keyboard inserts silently when
 * someone types a customer's name or a note; the final replace is the backstop
 * for everything else, including Urdu, which cannot be drawn in Helvetica at
 * all. A name that comes through as "?" is a poor statement; a download that
 * fails with a stack trace is no statement.
 */
function ascii(value) {
  return String(value ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Cut a string to fit `width`, with an ellipsis, measuring in the real font. */
function fit(text, font, size, width) {
  const clean = ascii(text);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;

  let low = 0;
  let high = clean.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (font.widthOfTextAtSize(`${clean.slice(0, mid)}...`, size) <= width) low = mid;
    else high = mid - 1;
  }
  return `${clean.slice(0, low)}...`;
}

// ---------------------------------------------------------------------------
// A tiny drawing surface, so the layout below reads as layout
// ---------------------------------------------------------------------------

/**
 * A cursor that walks DOWN the page and starts a new one when it runs out.
 *
 * pdf-lib measures from the bottom-left, which is correct for PostScript and
 * backwards for anyone laying out a document. `y` here is distance from the top
 * and `at()` does the flip once, in one place, so no call site has to.
 */
class Sheet {
  constructor(doc, fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.pages = [];
    this.onNewPage = null;
    /** True only while table rows are being drawn - see onNewPage below. */
    this.inTable = false;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(this.page);
    this.y = MARGIN;
    if (this.onNewPage) this.onNewPage(this);
    return this.page;
  }

  /** Distance from the top -> pdf-lib's distance from the bottom. */
  at(y = this.y) {
    return A4.height - y;
  }

  /** How much room is left before the footer's reserved strip. */
  get room() {
    return A4.height - MARGIN - 22 - this.y;
  }

  /** Break to a new page unless `height` still fits. */
  ensure(height) {
    if (this.room < height) this.newPage();
  }

  text(value, { x = MARGIN, size = 9.5, font = 'regular', color = COLOR.ink, width, align } = {}) {
    const typeface = this.fonts[font];
    const string = width ? fit(value, typeface, size, width) : ascii(value);

    let left = x;
    if (align === 'right') left = x + width - typeface.widthOfTextAtSize(string, size);
    else if (align === 'center') {
      left = x + (width - typeface.widthOfTextAtSize(string, size)) / 2;
    }

    this.page.drawText(string, { x: left, y: this.at() - size, size, font: typeface, color });
    return this;
  }

  box(x, width, height, color, { y = this.y } = {}) {
    this.page.drawRectangle({
      x,
      y: A4.height - y - height,
      width,
      height,
      color,
    });
    return this;
  }

  rule({ y = this.y, color = COLOR.rule, thickness = 0.75, x = MARGIN, width = CONTENT } = {}) {
    this.page.drawLine({
      start: { x, y: A4.height - y },
      end: { x: x + width, y: A4.height - y },
      thickness,
      color,
    });
    return this;
  }

  down(amount) {
    this.y += amount;
    return this;
  }
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

/** The logo, or null. A missing file must never fail a download. */
async function loadLogo(doc) {
  try {
    const bytes = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

/**
 * The letterhead - logo BESIDE the name, not above it.
 *
 * It was stacked, and that cost about 26pt at the very top of the page, which
 * does not sound like much until you follow it down: an ordinary ten-fill
 * account then pushed its closing note and signature strip onto a second page
 * that held nothing else. A page of white paper with two ruled lines on it is
 * what someone hands over by mistake, and the copy that matters gets left in the
 * printer. Side by side, the same account finishes on one page.
 */
function drawLetterhead(sheet, logo) {
  const top = sheet.y;
  let textX = MARGIN;

  if (logo) {
    // Fixed HEIGHT, width follows the aspect ratio - a logo swapped for a wider
    // one then keeps its proportions instead of being squashed to a box.
    const height = 38;
    const width = Math.min((logo.width / logo.height) * height, 110);
    sheet.page.drawImage(logo, { x: MARGIN, y: sheet.at(top) - height, width, height });
    textX = MARGIN + width + 14;
  }

  sheet.y = top + 6;
  sheet.text(BUSINESS_NAME, {
    x: textX,
    width: CONTENT - (textX - MARGIN),
    size: 16,
    font: 'bold',
    color: COLOR.brand,
  });
  sheet.down(19);
  sheet.text('Statement of account', {
    x: textX,
    width: CONTENT - (textX - MARGIN),
    size: 11.5,
    font: 'bold',
    color: COLOR.ink,
  });

  sheet.y = top + (logo ? 42 : 32);
}

/**
 * Who it is for and what it comes to - the two things read first, side by side.
 *
 * The amount goes on the right at 26pt because on a statement that is the whole
 * message; everything below it is the working. The panel behind it is red when
 * money is owed and green when it is not, so the answer is legible from across
 * a desk before a single figure has been read.
 */
function drawCustomerAndTotal(sheet, { customer, statement }) {
  const panelWidth = 196;
  const panelX = MARGIN + CONTENT - panelWidth;
  const top = sheet.y;

  // ---- the customer ----
  sheet.text('BILLED TO', { size: 7.5, font: 'bold', color: COLOR.faint });
  sheet.down(12);
  sheet.text(customer.name, { size: 14, font: 'bold', width: CONTENT - panelWidth - 16 });
  sheet.down(15);

  for (const line of [customer.vehicle_number, customer.phone].filter(Boolean)) {
    sheet.text(line, { size: 9.5, color: COLOR.muted, width: CONTENT - panelWidth - 16 });
    sheet.down(12);
  }

  sheet.down(2);
  sheet.text(`Statement date  ${formatDateLong(statement.asOf)}`, {
    size: 9,
    color: COLOR.muted,
  });
  sheet.down(12);
  sheet.text(
    statement.cutoff
      ? `Covering  ${formatDate(statement.cutoff)} to ${formatDate(statement.asOf)}`
      : 'Covering  every unpaid fill on the account',
    { size: 9, color: COLOR.muted, width: CONTENT - panelWidth - 16 },
  );

  const textBottom = sheet.y + 12;

  // ---- the figure ----
  const settled = statement.settled;
  const panelHeight = 78;
  sheet.box(panelX, panelWidth, panelHeight, settled ? COLOR.brandTint : COLOR.dueTint, {
    y: top,
  });

  sheet.y = top + 14;
  sheet.text(settled ? 'NOTHING OUTSTANDING' : 'TOTAL NOW DUE', {
    x: panelX,
    width: panelWidth - 14,
    align: 'right',
    size: 7.5,
    font: 'bold',
    color: settled ? COLOR.brand : COLOR.due,
  });
  sheet.down(14);
  sheet.text(formatPKR(statement.totalDue), {
    x: panelX,
    width: panelWidth - 14,
    align: 'right',
    size: 26,
    font: 'bold',
    color: settled ? COLOR.brand : COLOR.due,
  });
  sheet.down(32);
  sheet.text(
    settled
      ? 'All dues cleared'
      : statement.oldestOpenAge > 0
        ? `Oldest unpaid fill is ${statement.oldestOpenAge} days old`
        : 'Taken today',
    {
      x: panelX,
      width: panelWidth - 14,
      align: 'right',
      size: 8.5,
      color: COLOR.muted,
    },
  );

  sheet.y = Math.max(textBottom, top + panelHeight) + 14;
}

/**
 * The ageing strip.
 *
 * Standard practice on a receivables statement, with non-standard bands - see
 * AGE_BANDS in customer-statement.js for why 7/15/30 and not 30/60/90. Bands
 * holding nothing are drawn greyed rather than dropped, so the strip is the same
 * shape on every statement and the eye learns where to look.
 */
function drawAgeing(sheet, statement) {
  sheet.ensure(56);

  sheet.text('HOW OLD THE DUES ARE', { size: 7.5, font: 'bold', color: COLOR.faint });
  sheet.down(12);

  const gap = 8;
  const width = (CONTENT - gap * (statement.aging.length - 1)) / statement.aging.length;
  const top = sheet.y;

  statement.aging.forEach((band, index) => {
    const x = MARGIN + index * (width + gap);
    const empty = band.amount < 0.5;
    // Only the last band is a problem, and only when there is something in it.
    const alarming = band.key === 'over' && !empty;

    sheet.box(x, width, 38, alarming ? COLOR.dueTint : COLOR.band, { y: top });

    sheet.y = top + 8;
    sheet.text(band.label, {
      x: x + 8,
      width: width - 16,
      size: 7.5,
      color: empty ? COLOR.faint : COLOR.muted,
    });
    sheet.down(11);
    sheet.text(formatPKR(band.amount), {
      x: x + 8,
      width: width - 16,
      size: 12,
      font: 'bold',
      color: empty ? COLOR.faint : alarming ? COLOR.due : COLOR.ink,
    });
  });

  sheet.y = top + 38 + 16;
}

function drawTableHead(sheet) {
  const top = sheet.y;
  sheet.box(MARGIN, CONTENT, 20, COLOR.band, { y: top });
  sheet.y = top + 6;

  let x = MARGIN;
  for (const column of COLUMNS) {
    sheet.text(column.label, {
      x: x + 6,
      width: column.width - 12,
      align: column.align,
      size: 7.5,
      font: 'bold',
      color: COLOR.muted,
    });
    x += column.width;
  }

  sheet.y = top + 20;
}

/*
 * Row heights. A fill carries a second line for its fuel and litres; a hand-typed
 * entry ("opening balance from old register") does not. 25 rather than the 28
 * this started at, which is the single biggest saving available on a page that
 * is mostly table - ten fills give back 21pt, and the second line still clears
 * the first comfortably at 8pt.
 */
const ROW_TALL = 25;
const ROW_SHORT = 19;

/** One open item. Returns the height so the caller can page-break on it. */
function drawItemRow(sheet, item) {
  const hasSecondLine = Boolean(item.litres || item.fuelType);
  const height = hasSecondLine ? ROW_TALL : ROW_SHORT;
  const top = sheet.y;

  const cells = {
    date: formatDate(item.date),
    detail: item.detail,
    original: formatPKR(item.original),
    paid: item.paid >= 0.5 ? `- ${formatPKR(item.paid)}` : '-',
    due: formatPKR(item.due),
    age: String(item.ageDays),
  };

  let x = MARGIN;
  sheet.y = top + 5;
  for (const column of COLUMNS) {
    /*
     * A part-paid line is the one that gets queried, so the amount that came off
     * it is drawn in the same green the app uses for money received. The number
     * carries a minus sign as well - colour is never the only cue, on screen or
     * on a page that may be photocopied in black and white.
     */
    const color =
      column.key === 'due'
        ? COLOR.ink
        : column.key === 'paid' && item.paid >= 0.5
          ? COLOR.brand
          : column.key === 'age' || column.key === 'date'
            ? COLOR.muted
            : COLOR.ink;

    sheet.text(cells[column.key], {
      x: x + 6,
      width: column.width - 12,
      align: column.align,
      size: 9.5,
      font: column.key === 'due' ? 'bold' : 'regular',
      color,
    });
    x += column.width;
  }

  if (hasSecondLine) {
    sheet.y = top + 16;
    const detailX = MARGIN + COLUMNS[0].width;
    const parts = [
      item.fuelType ? item.fuelType.charAt(0).toUpperCase() + item.fuelType.slice(1) : null,
      item.litres ? formatLitres(item.litres) : null,
    ].filter(Boolean);
    sheet.text(parts.join('  '), {
      x: detailX + 6,
      width: COLUMNS[1].width - 12,
      size: 8,
      color: COLOR.faint,
    });
  }

  sheet.y = top + height;
  sheet.rule({ color: rgb(0.93, 0.94, 0.95), thickness: 0.5 });
  return height;
}

/**
 * The carried-forward line, when a day range was asked for.
 *
 * This is the line that keeps the page honest. Without it, "last 30 days" prints
 * a list of fills that adds up to less than the total at the foot, and the first
 * customer to add up the column has a grievance. It says how many fills are
 * behind it and how far back they start, so the statement never conceals the
 * shape of what it is summarising.
 */
function drawBroughtForward(sheet, statement) {
  const top = sheet.y;
  sheet.box(MARGIN, CONTENT, 26, COLOR.band, { y: top });

  sheet.y = top + 6;
  sheet.text('Brought forward', {
    x: MARGIN + COLUMNS[0].width + 6,
    width: COLUMNS[1].width - 12,
    size: 9.5,
    font: 'bold',
  });

  const dueX = MARGIN + COLUMNS.slice(0, 4).reduce((sum, c) => sum + c.width, 0);
  sheet.text(formatPKR(statement.broughtForward), {
    x: dueX + 6,
    width: COLUMNS[4].width - 12,
    align: 'right',
    size: 9.5,
    font: 'bold',
  });

  sheet.y = top + 16;
  sheet.text(
    `${statement.broughtForwardCount} earlier ${
      statement.broughtForwardCount === 1 ? 'fill' : 'fills'
    } still unpaid, from ${formatDate(statement.oldestBroughtForward)}`,
    {
      x: MARGIN + COLUMNS[0].width + 6,
      width: COLUMNS[1].width + COLUMNS[2].width + COLUMNS[3].width - 12,
      size: 8,
      color: COLOR.muted,
    },
  );

  sheet.y = top + 26;
  sheet.rule({ color: rgb(0.93, 0.94, 0.95), thickness: 0.5 });
}

function drawTotal(sheet, statement) {
  sheet.ensure(40);
  const top = sheet.y + 4;

  sheet.box(MARGIN, CONTENT, 30, COLOR.dueTint, { y: top });
  sheet.y = top + 9;

  sheet.text('TOTAL NOW DUE', {
    x: MARGIN + 10,
    width: 200,
    size: 9.5,
    font: 'bold',
    color: COLOR.due,
  });
  sheet.text(formatPKR(statement.totalDue), {
    x: MARGIN,
    width: CONTENT - 10,
    align: 'right',
    size: 13,
    font: 'bold',
    color: COLOR.due,
  });

  sheet.y = top + 30 + 14;
}

/**
 * Payments received inside the window.
 *
 * The owner's words were "if the customer already paid in between, it should
 * skip those in the statement" - and the fills those payments cleared are indeed
 * gone from the list above. But a man who paid Rs 25,000 last week and is handed
 * a page that never mentions it will ask where it went, and he is right to. So
 * the fills are skipped and the payments are acknowledged: it shows the work,
 * and it is the difference between a demand and a statement.
 */
function drawPayments(sheet, statement) {
  if (statement.payments.length === 0) return;

  sheet.ensure(50);
  sheet.text(
    statement.cutoff ? 'PAYMENTS RECEIVED IN THIS PERIOD' : 'PAYMENTS RECEIVED',
    { size: 7.5, font: 'bold', color: COLOR.faint },
  );
  sheet.down(14);

  const total = statement.payments.reduce((sum, payment) => sum + payment.amount, 0);

  for (const payment of statement.payments) {
    sheet.ensure(18);
    const top = sheet.y;
    sheet.text(formatDate(payment.date), {
      x: MARGIN + 6,
      width: COLUMNS[0].width,
      size: 9.5,
      color: COLOR.muted,
    });
    sheet.text(payment.detail, {
      x: MARGIN + COLUMNS[0].width + 6,
      width: 260,
      size: 9.5,
    });
    sheet.text(formatPKR(payment.amount), {
      x: MARGIN,
      width: CONTENT - 6,
      align: 'right',
      size: 9.5,
      font: 'bold',
      color: COLOR.brand,
    });
    sheet.y = top + 15;
  }

  sheet.down(2);
  sheet.rule();
  sheet.down(6);
  sheet.text('Total received', { x: MARGIN + 6, width: 200, size: 9, font: 'bold' });
  sheet.text(formatPKR(total), {
    x: MARGIN,
    width: CONTENT - 6,
    align: 'right',
    size: 9.5,
    font: 'bold',
    color: COLOR.brand,
  });
  sheet.down(16);
  // On a settled account there are no fills above to have taken them off.
  sheet.text(
    statement.settled
      ? 'These cleared the fills they were paid against.'
      : 'These have already been taken off the fills above.',
    { size: 8.5, color: COLOR.muted },
  );
  sheet.down(14);
}

/** The page when there is nothing to chase. */
function drawAllClear(sheet, statement) {
  const top = sheet.y;
  sheet.box(MARGIN, CONTENT, 76, COLOR.brandTint, { y: top });

  sheet.y = top + 16;
  sheet.text('All dues cleared', {
    x: MARGIN + 16,
    width: CONTENT - 32,
    size: 15,
    font: 'bold',
    color: COLOR.brand,
  });
  sheet.down(22);
  sheet.text(
    `There is nothing outstanding on this account as at ${formatDateLong(statement.asOf)}.`,
    { x: MARGIN + 16, width: CONTENT - 32, size: 10, color: COLOR.ink },
  );
  sheet.down(15);
  sheet.text(
    statement.unapplied >= 0.5
      ? `${formatPKR(statement.unapplied)} is held in credit against the next fill.`
      : 'Thank you. Every fill taken on credit has been paid for.',
    { x: MARGIN + 16, width: CONTENT - 32, size: 10, color: COLOR.muted },
  );

  sheet.y = top + 76 + 20;
}

/**
 * The two things that stop this being argued with.
 *
 * The allocation note, because oldest-first is a convention and the page must
 * say so (see customer-statement.js). And the receipt strip, because in practice
 * this sheet goes out with someone collecting cash and comes back as the record
 * that it was collected - which it can only be if there is somewhere to sign.
 */
function drawClosing(sheet, statement) {
  sheet.ensure(84);
  sheet.down(4);

  if (!statement.settled) {
    sheet.text(
      'Payments are applied to the oldest fill first, so a fill drops off this list once it has been covered.',
      { size: 8.5, color: COLOR.muted, width: CONTENT },
    );
    sheet.down(11);
  }

  sheet.text(
    `Figures are as at ${formatDateLong(statement.asOf)}. Anything paid after that is not on this page.`,
    { size: 8.5, color: COLOR.muted, width: CONTENT },
  );
  sheet.down(11);
  sheet.text('Please check this against your own record and tell us at once if anything differs.', {
    size: 8.5,
    color: COLOR.muted,
    width: CONTENT,
  });

  if (statement.settled) return;

  sheet.down(26);
  const lineWidth = (CONTENT - 40) / 2;
  sheet.rule({ width: lineWidth, color: COLOR.faint });
  sheet.rule({ x: MARGIN + lineWidth + 40, width: lineWidth, color: COLOR.faint });
  sheet.down(7);
  sheet.text('Amount received, and signature', { size: 8, color: COLOR.muted });
  sheet.text('Customer signature', { x: MARGIN + lineWidth + 40, size: 8, color: COLOR.muted });
}

/** Page numbers, written last, when the count is finally known. */
function stampFooters(sheet, customer) {
  sheet.pages.forEach((page, index) => {
    const label = `${ascii(customer.name)}  -  page ${index + 1} of ${sheet.pages.length}`;
    const size = 7.5;
    page.drawText(label, {
      x: MARGIN,
      y: MARGIN - 12,
      size,
      font: sheet.fonts.regular,
      color: COLOR.faint,
    });
    const right = `${ascii(BUSINESS_NAME)}`;
    page.drawText(right, {
      x: MARGIN + CONTENT - sheet.fonts.regular.widthOfTextAtSize(right, size),
      y: MARGIN - 12,
      size,
      font: sheet.fonts.regular,
      color: COLOR.faint,
    });
  });
}

// ---------------------------------------------------------------------------

/**
 * Build the statement. Returns a Uint8Array ready to write to the response.
 *
 * `statement` is what buildStatement() in customer-statement.js produced; this
 * file does no arithmetic of its own beyond adding up the payments it lists.
 */
export async function buildStatementPdf({ customer, statement }) {
  const doc = await PDFDocument.create();

  doc.setTitle(`Statement of account - ${ascii(customer.name)}`);
  doc.setAuthor(BUSINESS_NAME);
  doc.setSubject(`Dues outstanding as at ${statement.asOf}`);
  doc.setProducer(BUSINESS_NAME);
  doc.setCreator(BUSINESS_NAME);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const logo = await loadLogo(doc);
  const sheet = new Sheet(doc, fonts);

  /*
   * Page two onward gets a thin repeat of the letterhead and the column heads.
   * A long-standing account can run past one page, and a loose sheet of figures
   * with no name on it is unusable in a folder.
   */
  sheet.onNewPage = (self) => {
    if (self.pages.length === 1) return;
    self.text(`${BUSINESS_NAME}  -  statement for ${customer.name}`, {
      size: 8.5,
      font: 'bold',
      color: COLOR.muted,
      width: CONTENT,
    });
    self.down(14);
    self.rule();
    self.down(12);

    /*
     * The column heads repeat ONLY while the table is the thing that broke.
     * Unconditionally, they were drawn on a continuation page carrying nothing
     * but the closing note - a header for a table with no rows under it, which
     * reads as a page whose contents failed to print.
     */
    if (self.inTable) drawTableHead(self);
  };

  drawLetterhead(sheet, logo);
  sheet.rule();
  sheet.down(16);
  drawCustomerAndTotal(sheet, { customer, statement });

  if (statement.settled) {
    drawAllClear(sheet, statement);
    drawPayments(sheet, statement);
    drawClosing(sheet, statement);
    stampFooters(sheet, customer);
    return doc.save();
  }

  drawAgeing(sheet, statement);

  sheet.ensure(80);
  sheet.text(
    statement.cutoff ? 'UNPAID FILLS IN THIS PERIOD' : 'FILLS STILL UNPAID',
    { size: 7.5, font: 'bold', color: COLOR.faint },
  );
  sheet.down(13);
  sheet.inTable = true;
  drawTableHead(sheet);

  if (statement.broughtForward >= 0.5) drawBroughtForward(sheet, statement);

  for (const item of statement.items) {
    sheet.ensure(item.litres || item.fuelType ? ROW_TALL : ROW_SHORT);
    drawItemRow(sheet, item);
  }
  sheet.inTable = false;

  /*
   * Everything open is older than the window - the list is empty but the debt is
   * not. Silence here would read as "nothing owed" directly above a total that
   * says otherwise.
   */
  if (statement.items.length === 0) {
    sheet.down(8);
    sheet.text(
      `Nothing new was taken on credit in this period. The whole balance is carried forward from before ${formatDate(statement.cutoff)}.`,
      { size: 9, color: COLOR.muted, width: CONTENT, x: MARGIN + 6 },
    );
    sheet.down(16);
  }

  drawTotal(sheet, statement);
  drawPayments(sheet, statement);
  drawClosing(sheet, statement);
  stampFooters(sheet, customer);

  return doc.save();
}

/**
 * A filename someone can find again six months later.
 *
 * Name first because that is what the folder is sorted by when the owner is
 * looking for one customer, date second so successive statements for the same
 * customer sit in order under it.
 */
export function statementFilename(customer, asOf) {
  const name = ascii(customer.name)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `Statement-${name || 'customer'}-${asOf}.pdf`;
}
