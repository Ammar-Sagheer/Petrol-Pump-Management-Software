# UI conventions

The design system this app has settled into, built up over many rounds of
work rather than decided up front. Follow these instead of reinventing them.
See `docs/CHANGELOG.md` for the reasoning behind specific choices below —
several look simplifiable and were already tried that way once.

## The shared building blocks, at a glance

Everything in `app/_components/ui/` is generic and has no idea what a pump is.
Reach for one of these before writing markup; each has its own section below or
a comment at the top of the file saying why it exists.

| Component | What it is for |
|---|---|
| `<Dialog>` | Native `<dialog>` + `showModal()`. Full-screen sheet on a phone, centred panel above `sm`. No click-outside-to-close, deliberately. |
| `<ConfirmAction>` | Every "are you sure?": trash icon → dialog. Replaced seven inline confirms that shifted the page. |
| `<Pager>` | The row under a paged table — "Showing 1 to 8 of 26" plus Previous/Next. `pageFrom(searchParams)` reads and clamps `?page=`. |
| `<SubmitButton>` | A submit that disables itself and shows a pending label. Mandatory on anything destructive. |
| `<PendingLink>` | A link that shows a spinner while the navigation is in flight. Every server-rendered page needs one round trip. |
| `<IconButton>` | Square 44px icon-only row action. The one place an icon may stand without a word. |
| `<NumberInput>` | Blocks scroll-wheel and arrow-key changes that silently corrupt a typed figure. Use instead of bare `type="number"`. |
| `<FormMessage>` | Renders the `{ ok, message }` shape every Server Action returns. |
| `<EmptyState>` / `<PageHeader>` / `<FuelBadge>` / `<Icon>` / `<Spinner>` / `<BrandMark>` / `<Toast>` | Small, self-explanatory; see the files. |

Pump-specific ones worth knowing about in `app/_components/admin/`:

| Component | What it is for |
|---|---|
| `<DateNav>` | The day banner, arrows and date box on every dated page. `extraParams` carries a page's other filters through a day change. |
| `<StatGrid>` / `<StatTile>` | The four-figure strip. Container queries, not viewport breakpoints. |
| `<TrendRange>` | The Dashboard's 7 / 14 / 30 / 90-day chart window. |
| `<BalanceDirection>` | Which way a customer's balance moves, in register words: بنام / جمع. |
| `<ActivityTable>` | The audit trail. The one list that is a grid rather than a table — see why below. |
| `<GuideFlow>` | The bilingual guide's stages, steps, section map and roles table. |

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
  **One exception, deliberate**: the Lubricants header carries *Record a
  lubricant sale* and *Record a loose oil sale* side by side, both primary.
  They are peers — two kinds of the same job, and the drum is the more
  frequent of the two — so demoting either would point the reader at the
  wrong one. Two primaries are only right when neither action is subordinate;
  if one is, it is `.btn-secondary`.
- **`.btn-primary` carries an invisible 1px border in the fill colour, and it
  is load-bearing.** `.btn-secondary` and `.btn-danger` have a real border;
  without a matching one the filled button was 48px against their 50px, so
  every pair in the app — "Manage lubricants" beside "Record a lubricant sale",
  every dialog's Save beside Cancel — was two pixels apart and, being centred
  in a flex row, a pixel off each other's baseline. Too small to look like a
  bug, big enough to make the row look wrong: the owner reported it as the
  green ones being "a bit larger". If the fill colour changes, the border
  changes with it.
- `.btn-secondary` — everything else that isn't primary or destructive
  (white, ink border).
- `.btn-danger` — destructive or sign-out-style actions (white, red border
  and text, red hover fill). **Use this rather than hand-rolling red
  styles** — it was added for exactly this and had gone unused; the Sign
  out button was briefly a one-off red style before being folded into it.
- Size overrides are applied by adding utility classes after the component
  class, e.g. `className="btn-secondary px-2.5 py-1.5 text-xs"` for the
  compact buttons inside a table row, as on the staff list — the later
  utility classes win under Tailwind's
  cascade layers regardless of source order, since `@layer components`
  always loses to plain utilities.
- `<SubmitButton>` (`app/_components/ui/SubmitButton.js`) wraps a submit
  button in `useFormStatus()` so it disables itself and shows a
  `pendingLabel` while a Server Action is in flight — use it for every form
  submit instead of a plain `<button type="submit">`, to stop a slow
  connection producing a double-submit.

  **This is not optional on destructive buttons, and it was missed on
  thirteen of them.** Every confirm — Yes, remove / Yes, delete / Bring back
  / Sign out — was a plain `<button type="submit">`, so pressing it did
  nothing visible until the row disappeared. The owner reported it as the UI
  freezing, which is exactly what it looks like. A button that runs a Server
  Action and does not change is indistinguishable from a button that did not
  register the tap.

  The exception is a plain GET form that navigates — the month pickers on
  Expenses and Reports — where the route change brings its own `loading.js`.

- `<IconButton>` (`app/_components/ui/IconButton.js`) — a square icon-only
  button for a row action, currently the trash on every delete. It is the one
  deliberate exception to "icons never carry meaning alone": that rule is
  about icons carrying *information*, and this is a control whose word was
  being repeated down every row of a table. `label` is mandatory and becomes
  both `aria-label` and the hover `title`, and the action behind it must
  confirm **in words** before anything happens — nothing here destroys on the
  first click.

  Text stays where the words are the distinction: *Bring back* and *Delete
  for good* sit side by side on the removed-customers row, and two icons
  there would be a guess.

## Confirming a destructive action: a dialog, never inline

`<ConfirmAction>` (`app/_components/ui/ConfirmAction.js`) is every "are you
sure?" in the app: a trash `IconButton` that opens a `<Dialog>` with the
question, the consequence, and a red confirm. Seven components used to expand
inline instead and all seven had the same fault. (`DeleteBankAccountButton`
was already a dialog and is the precedent the rest now follow.)

**Why inline was wrong.** Each one replaced its own 44px icon with a question,
two buttons and sometimes a paragraph - *inside a table cell*. The row grew,
its column widened, and every row beneath it jumped down the page. On the
Customers list the row you were aiming at moved while you were reading the
question, which is the worst possible instant for a page to shift.

- **The caller keeps its own `useActionState`**, so each action has its own
  pending state and its own error message. `<ConfirmAction>` owns only the
  open/closed state and the chrome, and takes `action`, `state` and a `hidden`
  object of form fields.
- **A refusal keeps the dialog open.** Most of these can be turned down by the
  database - a customer who still owes money, a delivery a later reading
  depends on - and that message is the entire point of the interaction.
  Closing on failure throws it away. `state.ok` closes it; `state.ok === false`
  renders the message in place.
- **Room for the sentence that matters.** The fuel-rate confirm can now say
  *"readings already entered keep the rate they were sold at"* as a full
  warning rather than six words crushed into a cell. If a delete has a
  consequence people assume wrongly, the dialog is where it goes.
- **The trigger stays an icon**, per the `IconButton` rule - the row already
  names what the action applies to, and the dialog repeats it in words.
- **The exception is `PurgeCustomerButton`**, which keeps its own `<Dialog>`:
  its trigger has to be the words *Delete for good* because it sits beside
  *Bring back*, and its body owns a text field whose value gates the submit.
  When a confirmation needs more than a yes, write the dialog out.

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
  display as "Rs 339.5".
- **There is no paisa in this app's money, because there is no paisa coin in
  Pakistan.** `formatPKR` everywhere; a `formatPKRExact` that showed the ledger
  to two decimals was removed. Rates are the one exception, and only because a
  rate is a price on a board rather than something anyone hands over.

  This is a **storage** rule before it is a display one. `roundRupees` in
  `helpers.js` is applied to every write that becomes a customer debt or a
  payment — credit slips, payments, adjustments, lubricant sales — while
  `roundMoney` (2 dp) stays for the meter arithmetic, where litres × rate
  genuinely carries paisa and rounding would break reconciliation against
  stock. Rounding only the display would have been the worse half: three hidden
  0.28s make a rupee, and the running balance drifts away from the rows above
  it.

  Anything that *tests* a balance has to round the same way, or the screen and
  the rule disagree — see `delete_customer`, which refuses removal on a
  non-zero balance and had to round too, otherwise an account reading "Rs 0"
  could not be removed and the reason quoted a figure nobody can pay.

  **Three places round a balance and they must be changed together**:
  `formatPKR` (the column), the `notSquare` check in `RemoveCustomerButton`
  (the warning), and `delete_customer` (the rule). This was got wrong once
  already — the SQL was moved to whole rupees and the browser check left on a
  `0.01` threshold, so an account displaying "Rs 0" warned that it was not
  settled and would then have been removed happily by the database.

  **Round half away from zero**, never bare `Math.round`. Postgres `round()`
  and `Intl` both send −0.5 to −1; `Math.round(-0.5)` is `-0`, so a balance the
  column printed as "Rs -1" was being treated as settled. `roundRupees` does
  `sign * Math.round(abs(n))` for exactly this reason.

  **And watch for negative zero in output.** `Intl` formats −0.28 as the string
  `"-0"`, so a customer a few paisa the wrong side of zero had an Owes column
  reading "Rs -0". `formatPKR` collapses it.
- **`format-helpers.js` exists for the same reason `date-helpers.js` does**:
  `helpers.js` reads request cookies and so cannot enter a client bundle, which
  previously left client components formatting inline and drifting. Server code
  imports both through `helpers.js`.
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

**It does not close on a click outside**, deliberately. A `click` event
fires on the nearest common ancestor of `mousedown` and `mouseup`, so
selecting text in a field and releasing the button a few pixels past the
panel edge produced an event targeting the `<dialog>` itself — identical to
a real backdrop click, and it threw away a half-typed form. Every dialog
here holds entry someone is part-way through, so the affordances are all
deliberate ones: Escape, the header `✕`, and the form's own Cancel. Give
every dialog form a Cancel button; it is the visible way out.

The one intentional exception is the nav drawer in `AdminSidebar.js`, which
*does* close on its backdrop — it holds no input, and tap-outside-to-dismiss
is what people expect of a menu.

**A form that arrives already scrolled hides its own Save button**, so a
dialog form should fit a short laptop — 1024×768 is the shortest worth
checking, and the dialog caps itself at `90dvh`. `CustomerForm` did not: the
opening-balance cards are tall, and stacked in the default 32rem width it ran
195px past the bottom. Shrinking the cards would have undone the readability
they exist for, so it uses `size="lg"` with a two-column grid instead — the
contact fields on the left, the opening balance on the right. Reach for the
width before shrinking the content.

Phones are exempt: there the dialog is a full-screen sheet, the columns stack,
and scrolling a form is ordinary.

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

## Navigation

- `<AdminSidebar>` (`app/_components/admin/AdminSidebar.js`) is the whole of
  it: a fixed 240px column from `lg` up, a drawer behind a burger below that.
  `app/admin/layout.js` keeps the content clear of it with `lg:pl-60` — those
  two numbers have to agree and are the only two places the width appears.
- **Why a column and not a row of tabs.** Ten sections with an icon and a
  readable label need about 1350px laid out sideways, against a 1152px page.
  As a top bar they either scrolled — hiding Reports and Settings off the
  right of every laptop — or wrapped onto a second row that ate the top of
  every screen. Down the side, all ten fit at once with room to spare, which
  is what someone still learning where things live needs.
- **What it costs.** 240px off the left means the widest table in the app
  (Purchases, eight columns) scrolls inside its own card at 1024px, where it
  used to just fit. Inside the card, not the page.
- **The drawer is a real `<dialog>` opened with `showModal()`**, the same
  reasoning as `ui/Dialog.js`: focus trapping, Escape and an inert background
  come from the browser already correct. It closes on the pathname changing,
  not on the click — closing on click pulls it away while the next page is
  still loading, and the pending spinner on the link is the only feedback
  there is.

## Responsive: measure the container, not the window

Since the sidebar arrived, viewport breakpoints and content width are no
longer the same number — at a 1024px window a page has about 768px to work
in. `sm:`/`lg:` on anything laid out inside the content area therefore asks
the wrong question.

- `<StatGrid>` uses `@container` and `@[24rem]`/`@[50rem]` variants so its
  column count follows its own width. Asked for four columns at the `lg`
  *viewport* breakpoint it gave each tile 192px, and "Rs 4,386,211" at 24px
  does not fit that — the figures ran into their own dividers.
- Use the shared `<StatGrid>`/`<StatTile>` rather than hand-rolling a stat
  strip. Three pages had their own copy and all three had the same latent
  bug; they are one component now.

## Let spacing do the grouping

Readings lists six nozzles that belong to three physical units. Flat and
evenly spaced they read as six unrelated pumps, and the only thing saying
otherwise was the words "Unit 1 ·" repeated on two cards — a relationship the
reader had to compare character by character to see.

- **The gap carries the grouping**: 32px between units against 12px between
  the nozzles inside one. The heading only names what the spacing already
  showed.
- **Drop the repetition the grouping makes redundant.** With a "Unit 1"
  heading above them, the cards say "Nozzle A" and "Nozzle B". The *dialog*
  keeps the full "Unit 1 · Nozzle A", because it opens over the whole page
  with the heading out of sight — shorten a label only where the context that
  replaces it is on screen.
- **A group can carry its own progress** — "1 of 2 entered", green once done —
  so a finished group is skipped without reading its rows.

## The day on screen is stated once, and loudly

`<DateNav>` opens with a tinted banner carrying the relative label, the
weekday and the written date — "Yesterday · Thursday, 06 Aug 2026" — above
the arrows and the date box.

- **The weekday is the point.** A row of digits is easy to skim past, and the
  native date box is drawn in the *browser's* locale, so it may not even be in
  the order the reader expects. "Thursday" is checkable against the day
  someone has actually lived.
- **Tinted whenever it is not today** — grey for a past day, amber for a
  future one — so being somewhere else is noticed rather than read for.
- **There is always a label**, including "Past day". A day with no label
  looked identical to today at a glance, which is exactly the mistake the
  block exists to prevent.
- **Say it once.** The date used to appear three times on the same screen in
  three formats: the page description, the date box, and a small caption. The
  descriptions on the date-driven pages no longer repeat it — three quiet
  statements of one fact left none of them dominant, and the owner lost track
  of which day he was entering.

## A day-completion strip on Readings was tried and removed

Recorded so it is not rebuilt from scratch a third time. The idea was a strip
of recent days above the nozzle list, coloured by how many of that day's
nozzles had been entered, so a skipped day was visible at a glance. It was
built three ways and all three were removed:

1. **A band of tiles under the controls** — weekday, day number and a "3/6"
   fraction each. It measured fine and read as a second, competing set of date
   navigation, on a screen whose actual job is six nozzles. It also pushed the
   whole page down by its own height plus a margin.
2. **The same tiles inline** in the controls row — fixed the height, not the
   weight.
3. **Seven small circles** centred between the date banner and the Clear
   button, one number each, with a pulse on a day nobody had entered. Lighter
   again, and still the wrong thing on the page: *"I just needed a visual
   indication… things did not work out."*

**The lesson is about weight, not about tiles.** Every version was a
*secondary* signal — nice to have, not the reason anyone opens the screen —
and each one competed with the primary controls for the same glance. Making it
smaller each round narrowed the gap without closing it. If something like this
is wanted again, it has to cost visibly less than the date navigation beside
it, and it should probably not be interactive at all.

**What actually prevents the mistake is still there, and is not this.** The
red banner naming the missing day, and the confirm checkbox inside the entry
dialog — see "A gap the database allows on purpose still wants a checkbox"
below. Both work off `previous_date`, which `get_reading_sheet` (migration
009) has always returned; neither needed the strip or the RPC that fed it
(`get_reading_completion`, added in 037 and dropped in 038).


## Meter readings carry two decimals

A pump meter is a physical dial with a tenths digit, so 1,987,128.80 and
1,987,279.95 are the same shape of number. Formatted with a bare
`maximumFractionDigits` the first drops its trailing zero and renders a digit
shorter than the figure beside it — in a tabular font whose whole purpose is
keeping columns aligned, on a screen read in a hurry against cash in a
drawer. `ReadingForm` and `ReadingChainWarning` use a `meterFormat` with
`minimumFractionDigits: 2` for meter figures; litres sold keep the ordinary
format, since those are quantities rather than dial positions.

## A warning tells the reader their situation, not the general case

The reading-chain messages say the same thing two ways depending on whether
the day is already saved. On an unentered day the overlap is a prediction —
"saving would count them twice, and will be refused" — and that is what stops
the mistake. On a saved day the identical sentence describes something that
has already happened as though it were still avoidable, which invites someone
to hunt for a save button that is not there and conclude the message is
stale. A saved day is told what is true and what to do: "this day and 07 Aug
both cover the same 151.15 litres — one of the two has to be cleared."

## Two languages on one page

The Guide is the app's only bilingual screen, and the shape it uses is the
one to copy if another follows.

- **The text is data, not markup.** `app/_lib/guide-content.js` holds both
  languages against the same keys; the page renders that shape once and picks
  one. Two hand-written pages would drift the first time one was corrected.
- **The language is a query string** (`?lang=ur`), like the month filters on
  Reports and Expenses. No client component, no cookie, no stored preference
  — the browser follows a plain link, the server renders one language, and
  the Urdu version can be sent to someone as a link that opens in Urdu.
- **`dir` goes on the article**, and everything inside it must be
  direction-agnostic: flex rows follow `dir` on their own, spacing uses the
  logical `ms-`/`ps-`/`border-s` utilities rather than left and right, and
  anything that genuinely points is flipped with `rtl:`. A single `ml-` or
  `left-` inside that subtree silently breaks the Urdu layout, which is why
  `GuideFlow.js` says so at the top.
- **Diagrams are boxes and borders, not images.** They stay sharp, re-flow on
  a phone, keep their text selectable and readable at any size — and the same
  markup renders in Urdu without anything being redrawn.

## A long instruction page is read by scanning, not by reading

The Guide is the one screen in this app nobody reads front to back. It is
opened by an attendant who wants one answer, and closed again. Four devices
keep it scannable; copy these before adding prose to it.

- **A location chip instead of a sentence about where to go.** A step that
  happens somewhere carries `where: { icon, path }` in `guide-content.js`, and
  `GuideSteps` renders it under the heading as a brand-tinted pill with the
  nav icon: `⛽ Lubricants → Record a lubricant sale`. It uses the *same icon
  as the sidebar tab*, so it points at something the reader can already see.
  This is not the icons-carry-no-meaning-alone exception — the path is written
  out in words beside it.
- **A rule leads with its claim, in bold, then explains.** `rules.items` is
  `{ title, body }`, not a string, so ten rules can be taken in by reading ten
  short bold lines. Ten full paragraphs behind ten identical warning triangles
  gave the eye nowhere to land — the repeated icon marked nothing.
- **What is done once folds away.** The one-time setup was a quarter of the
  page height for a reader who will never do it. It is a native `<details>`
  with a `<summary>` styled as a card row: no JavaScript, no state, still
  found by the browser's own Ctrl-F, and the chevron rotates with
  `group-open:-rotate-90`. Fold anything the *usual* reader does not need,
  not anything that is merely long.
- **Cards are split by how often they are used, not by subject.** "Customers"
  became "Customers" (pay, add — routine) and "Fixing a customer" (edit,
  adjust, remove — rare, owner-only). A ten-line card covering six operations
  teaches worse than two four-line ones.

Both languages carry every marker or neither: after any edit, check the shape
(stages, steps, rules, role rows, and the icon on each) matches between `en`
and `ur`. Adding a chip to one language only is the easy mistake.

## Splitting a list by route, and when to take it back

The drum's sales had their own page for good reason and it was still wrong.
Both halves of that are worth keeping in mind, because the reasoning that
justified the split is the reasoning that now argues against it.

**Why it was split.** A run of rupee-priced pours — twenty rows saying "Loose
Oil · 0.034 L" — buried the four carton sales that need reading. True, and
still true.

**Why it came back.** A route split makes the reader decide *where a thing
lives* before they can look for it, and it means a figure that is one number in
the owner's head — "what did we take on oil today" — is never on one screen.
Two pages of totals also have to be reconciled by eye every time.

**What to do instead.** One list, a marker on the rows that differ, and a
filter above it: `All oil / Packed only / Loose only` as a chip row, defaulting
to all. The busy-Saturday case that justified the split is one tap away, and
the ordinary case is right. The old route stays as a `redirect()` to the
filtered view, because bookmarks and links out in the world do not know it
moved.

The general rule: **filter a list, do not split it across routes, unless the
two halves are genuinely different work.** Readings and Lubricants are separate
pages because a day of fuel is worked out once from six meters and oil is sold
one tin at a time. Packed and loose oil are the same work with a different
container.

## The Urdu word in brackets is the label, not the translation

`<BalanceDirection>` labels its options **"They owe the pump (بنام)"** and
**"They have paid ahead (جمع)"**, and the bracketed word is the one the reader
is actually looking for. بنام and جمع are what a Pakistani shopkeeper's
register has called a debit and a credit for a century; the owner has been
writing them by hand for years, and no English phrasing of "increases what
they owe" ever competed with that. The English stays as the gloss, because the
staff logins may not share the habit.

- **Same word for the same idea, everywhere.** The New customer form and the
  manual adjustment both use بنام / جمع, so the owner is choosing between two
  terms he already knows rather than two sentences he has to parse. The blank
  third option on the New customer form is **نیا کھاتہ** — "new account".
- **Wrap it in `<bdi>`.** Urdu is right-to-left, and an unmarked run of it
  inside an English sentence lets the bidi algorithm drag the surrounding
  brackets around — the closing paren ends up on the far side of the phrase.
  `<bdi lang="ur" dir="rtl">` isolates the run so the brackets stay put.
- **A step larger than the English beside it.** Urdu script carries more
  detail per character and is unreadable at the 14px a Latin label survives, so
  the `<bdi>` is `text-base` inside a `text-sm` line.
- **Keep the pair on one line** (`whitespace-nowrap` on the bracketed group).
  An opening paren stranded at the end of one line with the word on the next is
  worse than no bracket at all.

This is not the same thing as the Guide's bilingual page, which renders one
language or the other. Here both are on screen at once because they are doing
different jobs: the Urdu names the concept, the English explains it.

## Paging: `<Pager>`, and where the slice happens

`<Pager>` (`app/_components/ui/Pager.js`) is the row under every paged table:
a "Showing 21 to 39 of 39" sentence and the Previous/Next nav. It takes
`page`, `perPage`, `total` and **`hrefFor(page)`** — a function, not a base
path, because these tables already carry a date, a month or a customer id in
the query string and a pager that rebuilt the URL would silently drop them.
`pageFrom(searchParams)` beside it reads and clamps `?page=`.

**What needs paging.** Anything that shows everything since the pump opened:
Purchases, Banking, Stock checks, a customer's ledger. A table scoped to one
day or one month is bounded by how much can happen in that time and does not
need it — with one exception, the two sales tables, where a busy day runs to
dozens of rows and pushes the stock table below them out of reach.

**Where to slice — this is the part that bites.** Two options, and the wrong
one silently corrupts a figure:

- **Page in the database** (`range()` + `count: 'exact'`) when the list is
  *only* a list. The customer ledger is the clean case: the balance and the
  fuel breakdown come from `get_customer_statement`, which sums in Postgres
  over everything, so paging the rows changes only what is displayed.
- **Fetch it all and `slice()`** when the page derives anything from the whole
  set. Purchases totals what is still owed to suppliers; Banking counts
  transactions per account; Stock checks looks up the check belonging to the
  date on screen. A database page would turn each of those into "…of whatever
  is on this screen".

The same trap had already been laid by plain `.limit()` defaults, which is
worse because nothing on screen says a cap was applied: `getPurchases` stopped
at 100, so the hundred-and-first delivery pushed the oldest unpaid ones out of
the "still owed" total. **A cap on a list you are going to total is a cap on
the total.** Those caps were removed rather than paged around.

## Long tables get their own paged page

A table that grows without bound does not belong sitting open on a page that
is read for something else. Two of them now follow the same shape, and a
third should copy it rather than invent another:

- The page it lives on keeps a **bounded, recent slice** — five rate changes
  on Settings, the chosen month of daily sales on Reports — and links to the
  full history.
- **A preview is a glance, so size it to fit without scrolling.** The Settings
  slice was seven whole *days* of rates, chosen so a day's petrol and diesel
  could not be split; at two fuels a day that is fourteen rows, and the panel
  came back with its own scrollbar — a small scrolling table inside a page you
  scroll, which is the worst of both. The cap is now five rows, extended
  forward to the end of whatever date the fifth row falls on (so it shows five
  or six, never half a day). Keep the pairing rule; get the height from the
  cap, not from the calendar.
- The history is its own route with a pager: `/admin/settings/fuel-prices`
  and `/admin/reports/daily`. The page number is a **query string**, so Back
  works through it and any page can be linked to or reloaded.
- **Size the page to the viewport, not to a round number.** 25 rates a page
  overran `.table-scroll`'s 70vh cap and the card grew its own scrollbar, so
  the wheel did one of two different things depending on where the pointer
  was. Eight rows clear the cap at every width this app is read at, and
  `FuelPriceTable` sets `max-h-none` to drop the cap entirely now that neither
  of its callers can reach it — the sticky heading goes with it, and is no
  loss when the whole table is on screen. Keep the page size **even** where
  the rows come in pairs, so a day's petrol and diesel do not straddle the
  fold.
- The table itself is a shared component (`FuelPriceTable`,
  `DailySalesTable`) used by both, so the columns cannot drift apart between
  the summary and the history.
- Page by whatever the data is really counted in. Rates page by row; daily
  sales page by **date window**, because `get_sales_trend` fills in every day
  between two bounds including the ones with no trade, so a page is 25 days
  rather than 25 rows and the page count falls out of the distance between
  the first trading day and today.
- A dead pager button is a `<span>`, not a link styled to look disabled — a
  disabled-looking link is still focusable and still navigates. This now lives
  inside `<Pager>`; do not hand-roll it again.

## A chart that toggles view has state, not a route

`<SalesTrendChart>` on the Dashboard and Reports switches between rupees and
litres with a small pair of buttons above the chart, not a filter chip in the
URL.

**Why this one is different from `<TrendRange>` beside it.** That control
changes the *window*, which means a different set of rows and a new query.
This one changes only how the rows already on the page are drawn — both series
come back from `get_sales_trend` in the same call. Round-tripping to the
server for a view the client can already produce would be a spinner in
exchange for nothing, so it is `useState`, not a query string.

**Why it exists at all.** In rupees, the sales chart and the cash-vs-credit
chart beside it were drawing the same picture — on a pump paid almost entirely
in cash, "total sales" and "the cash bar" are the same height every day. Litres
is the view money cannot give: a rate change does not move the bars, so a quiet
day reads as a quiet day rather than as a cheaper one.

**Split by fuel, stacked rather than side by side**, so the bar height still
answers "how big was the day" the way the rupee view does, and the petrol/diesel
mix is legible inside it. Only the top segment gets a rounded corner, or the
lower one's corner notches into the segment above it.

**The emptiness check is asked of the series being shown.** A period can hold
only-zero litres in the same rows as only-zero rupees, so in practice these
agree — but checking the wrong series would put "no sales" over a chart that
has bars in the mode actually on screen.

## Filtering a chart: fixed windows, not a date range## Filtering a chart: fixed windows, not a date range

`<TrendRange>` (`app/_components/admin/TrendRange.js`) is how the Dashboard
charts are filtered, and the shape to copy for the next set.

- **The end of the window is already chosen elsewhere.** `<DateNav>` at the top
  of the page picks the day; the filter only says how far back to reach. Asked
  as a from/to pair it would be two date pickers, four taps, and a range that
  can be entered backwards or empty — none of which can happen here.
- **Four fixed windows** (7 / 14 / 30 / 90 days), one tap each. 90 is the point
  where a daily bar stops being readable at this width; past that the answer is
  a different chart, not a longer axis.
- **The current window is a `<span>`, not a link** — the same rule as the dead
  button in `<Pager>`. A link styled to look inert still takes focus and still
  navigates, to the page you are already on.
- **Two controls on one page means each carries the other's value.**
  `<DateNav extraParams={{ days }}>` threads the window through the day arrows,
  the date box (including the `noscript` GET form's hidden fields) and "Back to
  today". Miss one and stepping a day silently resets the filter, which reads
  as the arrow being broken.
- **`scroll={false}` on the window links.** A `<Link>` resets the scroll to the
  top, which is right when the whole page changes and wrong for a filter: the
  charts are the last thing on the Dashboard, so asking for 30 days instead of
  7 threw the reader back up past the tiles and the tanks to look at a chart
  they were already looking at. The rule generalises — **a control that changes
  only what is beside it should not move the page.**
- **State the span in words under the heading.** "Last 30 days" is ambiguous
  the moment the reader has stepped back a week — these charts end on the day
  the page is showing, not on today, so the dates are spelled out beneath it.
- **Validate the query string against the allowed set**, never `Number() || 14`.
  `trendDaysFrom()` returns the default for anything not in `TREND_WINDOWS`, so
  `?days=999` cannot ask the database for three years of daily rows.

## When a list should stop being a table

Every list in this app is a `<table>` that scrolls sideways inside its card
when it runs out of room. That is right for Purchases, Readings, the ledger —
lists of short numbers, where the columns stay readable and the reader knows
what is off to the right.

`<ActivityTable>` is the exception, and the test for when to copy it is
**whether the widest column is a sentence**. The activity log was a table
first: at 400px it measured perfectly — nothing clipped, no page scroll — and
looked broken, two narrow columns of timestamps beside acres of white, because
the row heights were being set by a 700px description sitting off-screen.
Scrolling right to find out *what happened* defeats the page.

The replacement is one piece of markup that is a grid of columns above
`@[54rem]` and a stack below it:

- **`@container` on the wrapper**, and container-query variants throughout —
  not `sm:`/`lg:`. With the 240px sidebar a 1024px window gives a page 768px,
  so viewport breakpoints answer the wrong question. See "Responsive: measure
  the container".
- **`@[54rem]:contents` is the trick that avoids two copies of the markup.**
  When/who/amount are wrapped in one div: below the threshold it is a flex row
  of small grey text under the event, and above it the wrapper dissolves so its
  three children become grid cells in their own columns.
- **DOM order is the phone order; `order-*` and `col-start-*` rearrange it for
  the columns.** What happened comes first in the markup, because that is what
  the reader came for, and moves to column three on a wide screen.
- **Size the columns to the content and prove it, then set the threshold above
  the total.** Measured: the timestamp needs 11.5rem, the longest name 11.6rem,
  a seven-figure sum 7.5rem. At a threshold of 46rem those columns cramped and
  "Rs 7,686,000" wrapped onto two lines — the exact regression the type rules
  call out. 54rem with 12/12/1fr/8rem does not.
- **`whitespace-nowrap` on the figures, not on the name.** A name that outgrows
  its column should wrap; a timestamp or an amount that does the same is a
  defect.
- **A placeholder is a column's problem, not a stack's.** The em-dash standing
  in for "no amount" is `hidden @[54rem]:inline` — in the stacked layout it
  would be a dash alone on a line, which is a thing to decipher rather than
  read.

## Picking one of a handful of categories: icon tiles, not a dropdown

`BalanceDirection` (below) is the pattern for choosing between two named
*directions*, read as sentences. `CategoryPicker`
(`app/_components/admin/CompanyAssetForm.js`, used by Company Assets) is the
pattern for choosing one of a small fixed set of *kinds of thing* — vehicle,
machinery, property, electronics, other — and it is deliberately a different
shape: a `role="radiogroup"` of icon tiles, not a `<select>`.

The reason is what there is to read. A direction is a sentence someone has to
understand; a category is a single word most people recognise on sight, and a
picture answers "which one" faster than five words in a closed dropdown ever
will — nothing to open, nothing hidden until you click. A `<select>` is right
when the list is long, alphabetical, or has no natural icon (a bank name, a
customer); tiles are right when the list is short and every option already
has an obvious symbol.

Shape of it:

- **`role="radiogroup"` / `role="radio"` / `aria-checked`**, with a hidden
  `<input type="hidden" name="…">` carrying the actual form value — the tiles
  are buttons, not a native input, so the value has to be smuggled in
  separately for the `<form action>` to see it.
- **`@container` on the wrapper, not a viewport breakpoint** — `grid-cols-3
  @[26rem]:grid-cols-5`. This picker lives inside a `Dialog`, whose width has
  nothing to do with the window; three columns on a phone's full-screen sheet,
  five once the dialog itself has room. Same reasoning as "Responsive: measure
  the container" above.
- **Active tile: `border-brand-600 bg-brand-50`, icon and label in
  brand-700/900. Inactive: `border-ink-300 bg-white hover:bg-ink-50`** — the
  same selected/unselected contrast used everywhere else a choice needs to
  read as chosen at a glance.
- **The icon set lives in `Icon.js` beside the app's other icons, not as a
  one-off inline SVG** — `vehicle`, `machinery`, `property`, `electronics`,
  `other` were added there so any future picker or badge can reuse them.
- **The category list itself (`{value, label, icon}`) is a plain data module**
  (`app/_lib/asset-categories.js`), not an export of the `'use client'` form
  file — see that file's own comment. Any list a client-side picker and a
  server-rendered page both need to read has to live outside the client
  boundary, the same reason `guide-content.js` is separate from `GuideFlow.js`.

## Moving money by hand: say which way, then show the result

Anywhere the owner moves a balance by hand — the manual adjustment, a new
customer's opening balance — two things are required, and the second matters
more than the first.

**Name the direction in yard language, not bookkeeping.** The original control
was a dropdown reading "Increases what they owe" / "Reduces what they owe", and
the owner could not tell them apart: two long phrases differing by one word in
the middle. Debit and credit would have been worse. `BalanceDirection`
(`app/_components/admin/BalanceDirection.js`) is the shared control, so the
same two ideas are never described in two vocabularies:

    owes       they owe the pump MORE   (a debit)
    in_credit  they owe the pump LESS   (a credit)

Each card carries a second line saying *when* to use it, because the situation
is easier to recognise than the arithmetic.

**Then show the balance the choice would produce.** This is the part that
actually prevents the mistake:

    Rs -4,999 → Rs -9,998
    The pump would owe them Rs 9,998 after this.

Picking the wrong direction does not fail — it silently moves a real balance
the wrong way, and no constraint can catch it because both directions are
legal. A label can be misread; a figure going from 4,999 to 9,998 when you
meant to clear an account cannot. **Any control where both choices are valid
and only the operator knows which is right should show its consequence before
it is committed.**

## A gap the database allows on purpose still wants a checkbox

Some actions are legal every time and wrong just often enough to need a second
look — entering a day's readings when the day before it was never opened is
the example this pattern was built for. Migration 027 deliberately allows it,
because backfilling a genuine gap later looks identical on the wire to
skipping a day by mistake, and the database cannot tell those two apart. The
UI is the only place that can, because it's the only place that knows whether
a human actually meant to.

`ReadingForm`'s `EntryForm` is the shape of it: `hasDateGap` compares the
nozzle's last reading (`previous_date`, which `get_reading_sheet` already
returns) against the calendar day right before the one being entered. When
they differ, the form does two things, not one:

- **Says what is true**, in a red box: which day (or range of days) has no
  reading, and what saving now will do to it — "will jump straight over it,"
  not a vaguer "may cause a discrepancy."
- **Gates the Save button on a checkbox inside that same box** — "Yes, 09 Aug
  2026 was missed on purpose — save this day anyway" — rather than only
  colouring the button or adding more red text next to it. `canSubmit` stays
  `false` until it is ticked, same mechanism as the other disqualifying
  conditions on that form (a negative litre count, credit exceeding the sale).

**Why a checkbox and not a second dialog.** `ConfirmAction` is for a
destructive action reached by its own trigger — the dialog IS the confirmation
and nothing else is happening on the page underneath it. Here the confirmation
has to appear *inside* a dialog that is already open and already mid-form, so
a second stacked dialog would be confirming a click already several steps into
a task, over content that would have to move out of the way for it. A checkbox
that must be ticked before the button will do anything asks the same question
with no extra layer: it cannot be dismissed with a stray Enter or a reflexive
tap the way a paragraph of warning text can be scrolled past.

**Why this and not a hard block.** A hard block would refuse the very case
027 exists to allow — the honest repair of entering a late day once the gap is
found. The checkbox is the fork between the two: it costs one tap when the
skip is deliberate, and it stops the tap that was never a decision at all,
which is what happened here.

## "Remove" means delete-or-retire, and the database decides

Two screens take something off a list — a lubricant, and a customer — and both
work the same way, so a third should copy it rather than invent a variant.

The button says **Remove**, never "Delete", because only one of the two
outcomes is actually a delete:

- **Never traded** — a typo, or an account opened and never used. Nothing to
  preserve, so the row goes.
- **Has history** — deleting would tear a hole in months already reported and
  exported. The row is *retired*: `is_active = false`, out of the working list
  and out of every dropdown, with its history left intact.

The caller cannot tell which applies from the row in front of them, so the RPC
decides and **returns which one happened** (`{ name, removed: true|false }`)
and the confirmation says so afterwards. A button that promised "Delete" would
be lying half the time.

Two things this pattern always needs:

- **A way back.** A retired row must stay findable and restorable, or "removed"
  is indistinguishable from "lost" — a *Removed* section under the main table
  with a **Bring back** button. `LubricantManager` and the Customers page are
  the two examples.
- **A third state, when retiring is not enough.** A name added by mistake that
  picked up entries is retired for ever and sits in the Removed list looking
  like a real customer who left. `PurgeCustomerButton` is the way out: offered
  **only from the Removed list**, so getting there is two deliberate decisions,
  and confirmed by **typing the name** rather than pressing Yes. Everything
  else destructive in this app is recoverable — a retired row comes back, a
  deleted sale posts a reversal — so the one action that is not asks for
  something a mis-aimed click cannot produce. The typed name is checked in the
  database as well as the browser; the browser copy only keeps the button
  disabled so the refusal is rare rather than routine.
- **A guard on anything retiring would hide.** A retired customer drops out of
  `get_customer_balances`, which is what the Customers page totals "still
  outstanding" from — so removing someone who owes Rs 50,000 would quietly drop
  Rs 50,000 from what the pump believes it is owed. Removal is therefore
  refused while the balance is non-zero, **in both directions**: money the
  customer owes, and money the pump owes them. Before adding this pattern to a
  third screen, ask what disappears from a total when the row leaves the list.

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
- `<h2 className="section-heading">` for the heading that names a block on a
  page. The spacing is in the class deliberately: written out by hand it had
  drifted, and of nineteen headings nine had a top margin and ten did not, so
  "Previous checks" sat flush against the card above it while the same
  heading elsewhere had room. `first:mt-0` covers both cases — a heading that
  opens a column or section is its container's first child and wants no gap;
  one that follows content is not, and gets the full one.
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

## `BalanceDirection` is the general two-choice-in-a-sentence control

It was written for the customer ledger and is named for it, but nothing in it
knows about money: it takes `options` of `{value, title, detail}` and renders
two cards with a hidden input carrying the value. Migration 039's dip timing
(**Morning — before the pumps opened** / **Evening — after the pumps closed**,
in `StockCheckForm`) is its second caller, and reusing it was the right call
over forty lines of near-identical markup.

Reach for it whenever a choice is **two options, both legal, told apart by
reading a sentence** — and follow the rule the section above states: *show the
consequence*. The dip card names the day the choice closes ("at the close of
10 Aug 2026") and the book figure that produces, then the gain or loss once a
reading is typed. That is what makes the choice checkable rather than merely
labelled, and it is the whole reason this control exists.

Use `CategoryPicker`'s icon tiles instead when the options are *kinds of
thing* recognised on sight. Use a `<select>` when the list is long.

## A figure and its unit must not be able to break apart

The dip card originally put the day inside the label — "Books at the close of
10 Aug 2026" — beside the figure on one row. At a phone's width the label
wrapped to two lines, squeezed the figure, and left **`L` alone on its own
line** under `2,392.88`. The DOM was fine; `scrollWidth` matched `clientWidth`;
it only showed up in the screenshot. (See the note at the top of this file, and
the Purchases-table entries — this is the third time.)

Two things fix it, and both are worth copying:

- **`whitespace-nowrap` on any figure rendered as "number + unit"** — the pair
  is one token to a reader and must be one to the layout.
- **A qualifying date goes on its own line, not into the label.** The label
  stays short and fixed ("Expected in tank"); "at the close of 10 Aug 2026"
  sits underneath. A date grows when the month name is longer, and a label
  sharing a row with a number is the wrong place for anything that grows.

## Two entry cards side by side: colour the whole card, name the thing twice

The Stock page puts the petrol and diesel dip boxes next to each other, and the
figures typed into them are four-digit numbers that look alike. Nothing
downstream can catch petrol's reading going into diesel's box — both are legal,
and a dip is the baseline every later day is measured from, so the mistake
propagates forward until somebody notices a tank behaving impossibly.

Until this change the two cards were identical but for a small badge and a
name in `text-sm`. Now:

- **The card wears its fuel's colour** — a solid `bg-sky-800` header band with
  white text for petrol, `bg-amber-400` with `text-ink-900` for diesel. The
  *same* sky and amber families `FuelBadge` uses everywhere else, so it
  reinforces an association the app has already taught rather than inventing a
  private one.
- **ONE DARK, ONE LIGHT. Never two of the same weight.** This is the rule, and
  it was learned by getting it wrong. Both bands were first made dark —
  `sky-800` against `amber-800` — reasoning that a pair matched in luminance
  would read as two tanks of equal standing, where a dark card beside a pale one
  silently ranks them. The owner's verdict, immediately: *"they both look the
  same, both are dark."*

  He was right and the reasoning was backwards. **Lightness is the cue the eye
  reads first**, and the one that survives poor light, a cheap screen and any
  colour-vision deficiency. Hue is the weaker, more fragile signal. Matching the
  luminance of two things whose entire job is to be told apart throws away the
  strongest difference available to buy a symmetry nobody asked for. sky-800 vs
  amber-800 is a **1.1× lightness gap** — which is to say none. Navy vs bright
  yellow is **6.5×**.
- **Then check each band carries its own text.** White on `sky-800` is 7.6:1;
  `ink-900` on `amber-400` is 10.7:1. Both clear AAA, the floor worth holding
  for a screen read in a forecourt office. (Watch the middle of the amber ramp:
  white on `amber-600` is 3.2:1 and fails AA outright.)
- **The colour is on the header and border only.** The body stays white. This is
  read on a cheap tablet in poor light and the figures need full contrast; a
  card washed in colour throughout costs exactly the legibility the colour was
  bought to protect.
- **Drop a badge the band has made redundant.** `FuelBadge` used to sit in this
  header and was removed: on a band that is already the fuel's colour, beside a
  name that already reads "Petrol Tank", it said a third time what had been said
  twice — and no single chip shade contrasts with both a navy and a yellow band.
- **Colour is never the only cue** (the standing rule, and it applies hardest
  here): the tank name is `text-base font-bold` in the fuel's darkest shade, the
  badge is beside it, and **the input's own label names the tank** — "**Petrol
  Tank** dip reading in litres". Anyone who cannot separate sky from amber still
  gets told twice which box they are in.

Reach for this whenever two or more entry surfaces sit side by side, accept the
same shape of value, and cannot validate each other.

## A date-driven page does not remount: reset form state yourself

`<DateNav>` changes the day with a client-side navigation. The page re-renders
with new props, but a form component in the same tree position **keeps all of
its `useState`** — it is the same component instance.

`StockCheckForm` learned this the hard way. Stepping from one day to the next
carried both the typed dip reading *and* the green "Saved…" line across with
it, so the next morning's card opened with **yesterday's reading already in the
box**, one tap from being saved again as today's measurement, under a message
describing a different day.

Two rules, and they are cheap:

- **Success goes to `<Toast>`, never inline.** `Toast`'s own comment has said
  this since it was written — *"a success message left sitting in a form is
  still there when the next entry is being typed"*. Failures stay inline in
  `<FormMessage>`, because an error has to survive long enough to act on. Guard
  the inline one with `state?.ok === false` rather than rendering both.
- **Clear the controlled state on success AND on date change.** `form.reset()`
  alone does nothing to a controlled input — the `useState` behind it has to be
  set back too. The date-change effect is the belt to the save-effect's braces:
  if a save is ever missed, the box still empties when the day does.


## A figure that is a moment in time should say which moment

The dashboard's tank card showed a bare litre figure under a list of that day's
sales, and the owner had to ask whether it was the level *before* or *after*
those sales. It is after — `get_daily_summary` returns the books at the close of
the day on screen — but nothing on the card said so.

It now carries the same line the Stock page card already used: **"at the close of
07 Aug 2026"**, directly under the figure. Cheap, and it removes a question that
had to be asked out loud once already.

The general rule: a number that means *"as at some moment"* and sits on a page
that can be scrolled through time must name its moment. Every other card on a
dated page describes the day in the banner; a figure that describes the day's
*end* looks identical to one describing its start.

## Fuel colours live in one file

`app/_lib/fuel-colors.js` is the single definition of what petrol, diesel and
lubricant look like. Everything reads from it: `FuelBadge`, the Dashboard's
by-fuel and tank cards, the tank progress bars, `SalesTrendChart`, and the Stock
page's dip cards.

Before it existed the colours were retyped in six files and **had already
drifted** — the charts used `#0284c7`/`#ca8a04` while the badges used the
sky/amber 100s, so the same fuel was one colour in a chart and a different one
in the table underneath it. A shared token is not tidiness here; it is the only
way the pump's two fuels stay recognisable across nine screens.

Each entry carries what the surfaces actually need:

| key | for |
|---|---|
| `solid` / `solidMuted` | a filled band or chip, and quieter text on it |
| `border` | the card outline that goes round a solid band |
| `onWhite` | the fuel's colour as text on a white background |
| `hex` | charts and progress bars, which need a raw value |

`fuelColor(type)` falls back to a neutral rather than to one of the fuels, so an
unrecognised value never silently paints itself petrol.

**The dark/light rule travels with them.** Petrol is a dark navy carrying white
text; diesel a bright yellow carrying near-black text. Any new surface keeps that
relationship — if a change would leave both light or both dark, it is wrong, for
the reason recorded in the section above and at length in the module's own
comment. Solid chips replaced the old pale tints for exactly this: two faint
pastels are the same chip to anyone glancing down a column of nozzles.
