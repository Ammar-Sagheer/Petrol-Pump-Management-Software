# UI conventions

The design system this app has settled into, built up over many rounds of
work rather than decided up front. Follow these instead of reinventing them.
See `docs/CHANGELOG.md` for the reasoning behind specific choices below —
several look simplifiable and were already tried that way once.

## Design tokens (`app/_styles/globals.css`)

- **Colors**: `brand-*` (green, `#059669` family) for the primary/positive
  action and success states; `ink-*` (slate) for text and neutral chrome;
  `petrol` / `diesel` for fuel-type accents; plain Tailwind `red-*` /
  `amber-*` for danger and warning, not custom tokens.
- Built for a cheap tablet in poor light: high contrast, large tap targets,
  `font-variant-numeric: tabular-nums` on every number so columns line up
  and a mistyped digit stands out (`.tabular`, `.input-number`, `.td-num`
  all set this).
- Tailwind v4's `@apply` cannot reference another custom class, so component
  classes in `globals.css` are each written out in full rather than composed
  from one another — mildly repetitive on purpose, so any one class works
  standalone in markup.

## Buttons

- `.btn-primary` — the one confirming/positive action per view (green).
- `.btn-secondary` — everything else that isn't primary or destructive
  (white, ink border).
- `.btn-danger` — destructive or sign-out-style actions (white, red border
  and text, red hover fill). **Use this rather than hand-rolling red
  styles** — it was added for exactly this and had gone unused; the Sign
  out button was briefly a one-off red style before being folded into it.
- Size overrides are applied by adding utility classes after the component
  class, e.g. `className="btn-secondary px-3 py-1.5 text-xs"` for the
  compact navbar buttons — the later utility classes win under Tailwind's
  cascade layers regardless of source order, since `@layer components`
  always loses to plain utilities.
- `<SubmitButton>` (`app/_components/ui/SubmitButton.js`) wraps a submit
  button in `useFormStatus()` so it disables itself and shows a
  `pendingLabel` while a Server Action is in flight — use it for every form
  submit instead of a plain `<button type="submit">`, to stop a slow
  connection producing a double-submit.

## Forms and Server Actions

- Every Server Action returns `{ ok: boolean, message: string }` via the
  `ok()` / `fail()` helpers in `app/_lib/actions.js`.
- `<FormMessage state={state} />` renders that shape directly: red for
  `ok: false`, brand-green for success. Put it directly above the submit
  button.
- **Money and rates are formatted by helper, never inline.** `formatPKR`
  rounds to whole rupees — right for a day's takings, wrong for anything
  per-litre. `formatRate` (`app/_lib/format-helpers.js`) always shows two
  decimals, so Rs 339.48 does not display as "Rs 339" and Rs 339.50 does not
  display as "Rs 339.5". `format-helpers.js` exists for the same reason
  `date-helpers.js` does: `helpers.js` reads request cookies and so cannot
  enter a client bundle, which previously left client components formatting
  inline and drifting. Server code imports both through `helpers.js`.
- `<Spinner>` (`app/_components/ui/Spinner.js`) — the shared pending
  indicator. `border-current` means it inherits the colour of whatever it
  sits in, so there is no per-context variant. Used by `PendingLink` and by
  the date box in `DateJump`.
- `<NumberInput>` (`app/_components/ui/NumberInput.js`) — use instead of a
  bare `<input type="number">` everywhere. It blocks the scroll-wheel and
  arrow-key value changes that silently corrupt a typed money/litres/meter
  figure — a real, previously-hit bug, not a hypothetical.
- Client forms follow this `useActionState` shape:
  ```jsx
  const [state, formAction] = useActionState(someAction, null);
  ```
  and reset (`formRef.current?.reset()`) on `state.ok`.

## Dialogs — the pattern for "set up once, not read constantly"

`<Dialog>` (`app/_components/ui/Dialog.js`) wraps the native `<dialog>`
element — real focus trapping, Escape-to-close, an inert background, and a
backdrop from the browser, not hand-rolled. On a phone it fills the screen
as a sheet rather than floating as a cramped centered box. Props: `open`,
`onClose`, `title`, `subtitle` (optional node), `size` (`'md'` default,
`'lg'` for content that needs more width, e.g. a table).

**When to put a form behind a dialog**: when the thing it creates is set up
rarely (an account, a staff login, a tank, a delivery) rather than read or
edited continuously the way a table on the same page is. A form that sits
open on the page permanently for a rare action steals space from — and
visual priority over — the content actually being worked with every day.
Concretely, that space cost showed up twice in this app's history:

- `BankAccountForm` — moved into a dialog because a four-field "add
  account" form sat open under the transaction list, when accounts are
  added twice ever and transactions are recorded every week.
- `PurchaseForm` ("Record a delivery") — moved into a dialog because the
  form's own width column left dead whitespace once the seven-column
  purchases table beside/below it needed the rest of the page.

**When to leave a form open on the page instead**: when filling it in is the
reason the page is opened at all, and the table beside it still fits the
`1fr` track (see "Layout: form beside a table"). `ExpenseForm` on
`/admin/expenses` is the reference case — an expense is recorded the day it
is paid, so putting it behind a button would add a click to the page's main
job to save space its neighbouring table does not need.

The **canonical implementation** to copy is `BankAccountForm.js`
(`app/_components/admin/BankAccountForm.js`) or `PurchaseForm.js`
(`app/_components/admin/PurchaseForm.js`, the more recent one):

```jsx
const [isOpen, setIsOpen] = useState(false);
const [notice, setNotice] = useState(null);
const [showResult, setShowResult] = useState(false);
const [state, formAction] = useActionState(someAction, null);

// Close on success and hand the confirmation to a Toast — a result belongs
// to the submission that produced it, so `handled` guards against the
// effect re-firing on an unrelated re-render.
const handled = useRef(state);
useEffect(() => {
  if (state === handled.current) return;
  handled.current = state;
  if (state?.ok) {
    setIsOpen(false);
    setNotice({ message: state.message });
    formRef.current?.reset();
  }
}, [state]);

return (
  <>
    <button type="button" onClick={() => { setShowResult(false); setIsOpen(true); }} className="btn-primary">
      <span aria-hidden="true">+</span> Add whatever
    </button>

    <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Add whatever">
      <form
        ref={formRef}
        action={(formData) => { setShowResult(true); formAction(formData); }}
        className="space-y-4 p-4"
      >
        {/* fields */}
        <FormMessage state={showResult ? state : null} />
        <div className="flex gap-2 border-t border-ink-200 pt-4">
          <SubmitButton className="btn-primary flex-1">Save</SubmitButton>
          <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Dialog>

    <Toast notice={notice} onDismiss={() => setNotice(null)} />
  </>
);
```

`showResult` matters: it keeps a stale error/success message from a
previous open from flashing before the new submission's own state lands.

**A dialog holding a table of rows gets ONE submit, not one per row.**
`NozzleSettingsButton.js` is the example: six nozzles, one "Save wiring".
Repeated field names (`nozzle_id`, `tank_id`, `starting_reading`) serialise in
markup order, so the action pairs them up by index. One button is also one
write — `set_nozzle_wiring()` does all six rows in a single UPDATE, because
six separate statements can fail part-way and leave the rows disagreeing with
each other.

The trigger button for a dialog form usually goes in `<PageHeader>`'s
`children` slot (see below), so it sits beside the title rather than inline
in the page body.

`<Toast>` (`app/_components/ui/Toast.js`) is for **success only** — it
self-dismisses after 6s, so an error placed there could vanish before
anyone reads it. Errors always render inline via `FormMessage`, next to the
field/form that caused them, not as a toast.

## Tables

- `.table-scroll` (`-mx-4 max-h-[70vh] overflow-auto px-4 sm:mx-0 sm:px-0`)
  wraps every `<table>` on a `.card`. It lets a wide table scroll
  *inside its own card* rather than push the whole page sideways, caps
  height so long lists don't run forever, and is what makes `.table-scroll
  thead th`'s `position: sticky` headers work — the wrapper has to be the
  scrolling element for a sticky child to have something to stick to.
- `.th` / `.td` — standard cell padding. `.td-num` additionally bakes in
  `whitespace-nowrap` and right-alignment, because a wrapped number
  (`"10,000` / `L"` on two lines) reads as two separate values. Always use
  `.td-num` for money/litres/counts, never plain `.td` with a `text-right`
  utility bolted on.
- **If a table's required width won't fit the page's available space**,
  the fix is architectural (give it more room — see "Layout: form beside
  table" below), never a padding/font-size squeeze to force it to fit. That
  was tried once for the Purchases table and reverted after a screenshot
  showed the Supplier column wrapping a real name across three lines — a
  numeric "no more scrollbar" win that was actually a worse regression.
  Always verify a table fix with a screenshot using realistic (not
  short/lorem) fixture text, not just a scrollWidth measurement.

## Layout: form beside a table

The recurring two-column pattern for a page that pairs a form with a
list/table:

```jsx
<div className="grid gap-6 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
  <FormComponent />
  <div>{/* table or list */}</div>
</div>
```

`[&>*]:min-w-0` is required — without it, a grid child can't shrink below
its content's natural size, which defeats `overflow-auto` on anything
inside it (a table trying to scroll internally instead ends up stretching
the grid track). Used on Settings (fuel prices), Account (staff list),
Banking.

**This only works when the table comfortably fits the `1fr` track** at the
page's `max-w-6xl` cap (~1152px page → roughly 744px of table budget once
the 22rem column and gap are subtracted). When it doesn't — Purchases'
seven-column table needed close to 850px — don't fight the split:
put the form behind a dialog instead (see "Dialogs" above) and let the
table have the full page width. A `position:relative; left:50%; ...`
"breakout" trick to widen just one page past `max-w-6xl` was tried for this
and abandoned — it worked above ~1280px viewport width but leaked a
page-level horizontal scrollbar at common laptop widths (1024–1152px); not
worth the fragility next to just removing the competing column.

## Type scale and readability

The reader is the owner, on a cheap tablet, in a pump office in the evening,
checking figures against cash in a drawer. The scale below is set for that,
not for a designer's monitor.

- **The data is bigger than the chrome.** A figure someone verifies is never
  smaller than the label describing it. Money and litres are `text-lg`
  (18px) in a row, `text-xl`/`text-2xl` in a stat tile; captions are
  `text-xs` (12px) and never smaller. Body copy is `text-base` (16px), not
  `text-sm`. This was the whole problem the readability pass fixed: nozzle
  figures were 14px under 10.4px uppercase labels, while the page heading
  that told the reader nothing was 24px.
- **`figure-label` and `figure-value`** (`globals.css`) are that pairing as
  two classes — a small uppercase caption over a tabular figure. Use them
  rather than hand-rolling the pair; every stat strip, nozzle row and dialog
  summary in the app now shares them, which is why the size is fixable in
  one place.
- **Grey has a floor of `ink-600`** for anything meant to be read. `ink-500`
  is for genuinely secondary text on white, `ink-400` only for disabled
  controls and placeholder text — it measures 2.6:1, which is below the
  accessibility minimum and unreadable in poor light.
- **A money figure never wraps and never clips.** `whitespace-nowrap` on the
  value, and the grid drops to one column below 380px rather than squeezing
  "Rs 4,386,211" into half a phone. Breaking after the "Rs" reads as two
  separate numbers for a moment, which is worse than a taller tile.
- **Buttons and tabs are `py-3` or taller**, giving a tap target around
  48px. These get pressed with a thumb, sometimes in a hurry.

## Icons

- `<Icon name>` (`app/_components/ui/Icon.js`) — the whole set, drawn inline
  on a 24px grid at 1.75 stroke, in `currentColor`. Adding one means editing
  that file; there is deliberately no icon package.
- **An icon never carries meaning alone.** Every icon in the app sits beside
  its own word — nav tabs, the Entered/Enter status, the Check warning — and
  is `aria-hidden`. The icon is the redundant second cue: shape, on top of
  the word and the colour. Status told apart by colour alone fails in dim
  light and for a red-green colourblind reader, which is exactly what
  "Enter" in amber next to "Entered" in green was doing.
- **Do not icon everything.** The fuel badges stay plain: Petrol, Diesel and
  Lubricant already differ in both word and colour, and a droplet on all
  three would add shape without adding distinction.

## Page structure

- `<PageHeader title description>{children}</PageHeader>`
  (`app/_components/ui/PageHeader.js`) — title + description on the left,
  and anything passed as `children` (typically a dialog-form's trigger
  button, sometimes more than one) right-aligned beside it, wrapping on
  narrow screens. This is where "Add account", "Record a delivery",
  "Nozzle settings" etc. live — not inline in the page body.
- `<EmptyState title description>{children}</EmptyState>`
  (`app/_components/ui/EmptyState.js`) — centered card for "nothing here
  yet", used instead of rendering an empty table.
- **A month-scoped page filters from `<PageHeader>`'s children**: a plain
  `method="GET"` form with `<input type="month" name="month">` and a "Show"
  button, posting back to the page's own path, with the page validating
  `/^\d{4}-\d{2}$/` and falling back to the current month. Used by Reports
  and Expenses. No Client Component and no Server Action needed — it is a
  query string, so the browser can submit it and a shared link keeps the
  month. Everything the page shows should follow it, including any table:
  a card scoped to the chosen month above a table showing all time reads as
  a contradiction, which is what the expenses block on Reports used to do.
- `<DateNav>` (`app/_components/admin/DateNav.js`) — previous/next arrows, a
  date box and "Back to today", used by Readings, Dashboard and Stock. Anything
  passed as `children` joins the end of its button row, so a page action for
  the day on screen shares that row's baseline. The box itself is
  `DateJump.js`, a Client Component: **picking a date navigates immediately**,
  there is no Go button, and clicking anywhere on the box opens the calendar
  (`showPicker()`) rather than only its icon. It ignores incomplete dates
  because a native date box fires `change` while the year is still being typed.
- **When the day's controls outgrow the header, give them their own row.**
  `<DateNav>` normally rides in `<PageHeader>`'s children, which is right for
  a date row plus at most one action. Lubricants carries two actions on top
  of the arrows and the date box, and `<DateNav>`'s "Back to today" appears
  only when the date is *not* today — enough extra width to tip the whole
  group over `PageHeader`'s wrap threshold, so the header jumped between one
  row and two as you stepped from today to yesterday and back. The fix is a
  `flex flex-wrap items-start justify-between` row of its own beneath the
  header, date controls left and actions right: it cannot wrap against the
  title, so nothing moves as the date changes. Reach for this only when a
  page really has that much in the row; a single trigger button still belongs
  in `PageHeader`.
- **A badge and the name it labels go on one line.** In the Purchases table
  the lubricant's name first sat under its badge, which made every lubricant
  row taller than the fuel rows either side of it and left the brand reading
  as a footnote to its own purchase. `flex items-center gap-2` with a
  `min-w-[13rem]` on the cell keeps the common name beside its badge on one
  line at 1024px while still letting a genuinely long one wrap rather than
  forcing a horizontal scrollbar.
- `<PendingLink>` (`app/_components/ui/PendingLink.js`) — use instead of
  `next/link`'s `<Link>` for any admin navigation. Every admin page fetches
  server-side, so a plain link leaves the screen looking frozen for a
  second with no feedback; this swaps in a spinner while the navigation is
  pending.

## Verification discipline

- A disposable `app/devcheck/page.js` route, rendering the real component
  with realistic fixture data (not placeholder text), is the standard way
  to screenshot a layout/component change with Playwright when scripting a
  real login is more overhead than the check needs. **It must never be
  committed** — `rm -rf app/devcheck` and confirm with `git status --short`
  before every commit.
- Screenshot at more than one viewport when a change touches layout —
  narrow-laptop widths (1024–1152px) and phone width (~400px) are where
  this app's layout bugs have actually shown up, not just the widest or
  most common width.
- A DOM boolean (`scrollWidth > clientWidth`, `hasScroll`) is a hint, not a
  verdict — a fix can make that boolean false while a screenshot shows text
  now wrapping somewhere it never used to. Always look at the rendered
  result with real-length data before calling a layout fix done.
