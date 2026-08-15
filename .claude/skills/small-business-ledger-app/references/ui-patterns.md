# The design language

Patterns settled over many rounds of work on a live app, most of them arrived
at by getting the obvious thing wrong first. Follow these rather than
reinventing them; a new pattern should be a deliberate choice, not an accident
of not knowing the existing one.

Read `references/readability.md` for type, colour and number formatting, and
answer the audience question in `SKILL.md` §0 before applying any of this — the
sizes below assume the older reader.

---

## Anything destructive confirms in a dialog, never inline

**The rule: a confirmation must not change the size of anything on the page.**

The tempting version is to swap the delete icon for a question and two buttons
in place. It is wrong for a reason that only shows up in use: inside a table
cell, a 44px icon becomes a three-line block, so the row grows, its column
widens, and every row beneath it jumps down the page. **The row someone is
aiming at moves while they are reading the question** — the worst possible
instant for a page to shift.

One shared `<ConfirmAction>`: an icon trigger, a dialog with the question, the
consequence, and a red confirm.

- **The caller keeps its own form state.** The shared component owns only
  open/closed and the chrome; the action, its pending state and its error
  message stay with the caller.
- **A refusal keeps the dialog open.** When the database turns something down —
  a customer who still owes money, a delivery a later entry depends on — that
  message *is* the interaction. Closing on failure throws away the only useful
  part.
- **There is now room for the sentence that matters.** "Readings already
  entered keep the rate they were sold at" fits in a dialog and does not fit in
  a table cell. If a delete has a consequence people assume wrongly, this is
  where it goes.
- **Write the dialog out by hand when a confirmation needs more than a yes** —
  a typed-name field for something irreversible, for instance.

Use a **native `<dialog>` with `showModal()`**, not a div. Focus trapping,
Escape, an inert background and the backdrop all come from the browser already
correct. Full-screen sheet on a phone, centred panel above `sm`.

**No click-outside-to-close on anything holding a form.** A `click` event fires
on the nearest common ancestor of mousedown and mouseup, so selecting text in a
field and releasing a few pixels past the panel edge targets the dialog itself
and is indistinguishable from a backdrop click. That silently threw away a
half-typed entry. Escape, a header ✕ and Cancel are enough. A nav drawer holds
no input and may close on its backdrop.

## Dialogs for what is set up once, forms for what is done daily

A form standing open on a page is a claim that it will be used every time the
page is opened. Recording the evening's takings, yes. Adding a bank account,
changing nozzle wiring, adding a product to the list — no. Those go behind a
button, and the page keeps its space for the work.

## Pagination wherever data grows

**A table that grows without bound does not belong sitting open on a page read
for something else.**

- The page it lives on keeps a **bounded, recent slice** and links to the full
  history. The history is **its own route with a pager**.
- **The page number is a query string**, so Back walks through it and any page
  can be linked or reloaded.
- **The table is a shared component** used by both, so the columns cannot drift
  apart between the summary and the history.
- **Page by whatever the data is really counted in.** Rows, usually. But a
  daily series that fills in empty days pages by *date window*, or the page
  count comes out wrong.
- **A dead pager button is a `<span>`, not a link styled to look disabled.** A
  disabled-looking link still takes focus and still navigates.

### Two traps, both hit for real

**A cap on a list you are going to total is a cap on the total.** A query
limited to 100 rows, on a page that sums supplier debt across all of them,
under-reports the debt from the 101st delivery onward — silently, forever.
Remove the cap and page the *display*; if the set ever gets genuinely large,
give the total its own aggregate query.

**Size the page to the viewport, not to a round number.** 25 rows overran a
table's max-height, so the card grew its own scrollbar inside a page that
already scrolls, and the wheel did one of two different things depending on
where the pointer sat. Count what fits and use that. Keep the page size **even**
where rows come in pairs, so a pair never straddles the fold.

### Sizing a preview slice

A preview is a glance, so it must fit without scrolling. But respect what the
rows mean: if two rows are read as a pair, cut on the pair boundary, not at an
exact count. Cap at *n* rows, then extend to the end of whatever group the last
row belongs to — five or six rows, never half a pair.

## Filters are query strings, and the current one is not a link

Chip rows — `All / Packed / Loose`, `7 / 14 / 30 / 90 days`, `Everyone / each
person`.

- **The selected chip is a `<span>` with `aria-current`**, not a link back to
  the page you are on.
- **`scroll={false}` on the others.** A router link resets the scroll to the
  top, which is right when the whole page changes and wrong for a filter. If a
  control changes only what sits beside it, it must not move the page.
- **Two controls on one page each carry the other's value.** A date stepper and
  a filter must both preserve the other in the URL, including any no-JavaScript
  form's hidden fields — miss one and stepping the date silently resets the
  filter, which reads as the *arrow* being broken.
- **Drop the page number when the filter changes.** Staying on page 4 of a list
  that just became six rows long shows an empty table and looks broken.
- **Validate against the allowed set**, never `Number(param) || default`, or a
  hand-edited URL asks the database for three years of daily rows.

## Filter a list; do not split it across routes

Splitting by route makes the reader decide *where a thing lives* before they can
look for it, and it means a figure that is one number in the owner's head —
"what did we take today" — is never on one screen.

Two kinds of the same record belong in one list with a marker on the rows that
differ and a filter above it. The busy-day view is then one tap away and the
ordinary case is right by default.

Separate routes are for genuinely different *work*, not different containers of
the same thing.

## When a list should stop being a table

Every list can be a table that scrolls sideways inside its card — right for
short numbers, where the reader knows what is off to the right.

**The test is whether the widest column is a sentence.** An audit log measured
perfectly at phone width — nothing clipped, no page scroll — and looked broken:
two narrow columns of timestamps beside acres of white, because the row heights
were set by a 700px description sitting off-screen. Scrolling right to find out
*what happened* defeats the page.

The replacement is one piece of markup that is a grid of columns above a
threshold and a stack below it:

- **`@container` on the wrapper**, container-query variants throughout.
- **`display: contents` at the breakpoint** is what avoids writing the markup
  twice: wrap the secondary fields in one element that is a flex row when
  stacked and dissolves into grid cells when wide.
- **DOM order is the phone order**; `order-*` and `col-start-*` rearrange it for
  the columns. What happened comes first in the markup, because that is what
  the reader came for.
- **Measure the columns, then set the threshold above their total.** Guessing
  produced a layout where a seven-figure sum wrapped onto two lines at a common
  laptop width — with the DOM reporting no clipping.

## Responsive: measure the container, not the window

Once there is a sidebar, viewport width and content width are different
numbers — a 1024px window may give a page 768px. `sm:` and `lg:` ask the wrong
question about anything inside the content area. Use `@container` and `@[..]`
variants so a component's layout follows *its own* width.

## Every control that waits says so

A button that runs a server action and does not change is indistinguishable
from a button that did not register the tap — and the natural response is to
press again. Wrap every submit so it disables itself and shows a pending label.

**This is not optional on destructive buttons.** Thirteen of them were missed in
one project and the owner reported it as the UI freezing, which is exactly what
it looks like.

Links that navigate to a server-rendered page need the same treatment: a
spinner in the link, and never close a drawer on the click — close it when the
navigation lands, or the only feedback disappears while the next page loads.

## Buttons

- One primary per view, and only break that when two actions are true peers.
- **A filled button and an outlined one must be the same height.** If the
  outlined one carries a 1px border, give the filled one an invisible border in
  its own fill colour. Two pixels is small enough never to look like a bug and
  large enough to make a row look wrong.
- Size overrides are utility classes after the component class, not new
  variants.

## Icons

- Draw them inline on one grid at one stroke weight rather than adding a
  package. Twenty icons is not a dependency.
- **An icon never carries meaning alone.** Every icon sits beside its own word
  and is `aria-hidden`. The icon is the redundant second cue: shape, on top of
  the word and the colour.
- **One deliberate exception**: an icon-only button for a row action, where the
  word was being repeated down every row. It needs a mandatory label that
  becomes both `aria-label` and the hover title, and the action behind it must
  confirm in words.
- **Do not icon everything.** Where two things already differ in word and
  colour, a third cue adds shape without adding distinction.

## Colour is never the only cue

The most common quiet failure. A stock column signalling "out of stock" by
printing the number red and nothing else is unreadable in a dim room and
identical to a healthy figure for a red-green colourblind reader. Add the word:
a small `out of stock` / `low` badge beside it.

Same rule for created/changed/deleted, paid/pending, entered/not entered.

### It is a floor, not a ceiling

The rule says what colour may not be the *only* carrier of. Applied backwards —
as "strip any hue that isn't doing a job" — it produces screens that are
correct and unpleasant, and the owner will tell you so in one word. A register
someone reconciles against a drawer earns its colour; a list someone browses
may simply have some. What makes a decorative hue safe is not that you found it
a meaning, but that **the thing it sits on is already fully identified without
it** — an icon and a written label, not one or the other.

Two hues it may never spend, in any app of this shape:

- **A colour the data owns.** If blue means petrol, nothing in the chrome is
  blue. A colour spent twice has stopped meaning anything, and the one that
  loses is the one doing the safety job.
- **A status colour, on a card carrying a figure.** Amber beside `132,000`
  reads as a warning about the number, whatever you intended it to say about
  the category. Same for red. This is what usually rules out the "obvious"
  palette and leaves a genuine ceiling of three or four usable hues — when you
  run out, let the next category fall to neutral rather than reaching for a
  reserved one.

Pale ground, dark glyph. A saturated fill puts the decoration above the figure,
which is the one thing on the card that has to lead.

## The day on screen is stated once, and loudly

On any page scoped to a date: one tinted banner carrying the weekday, the
written date, and what that day is relative to today — larger than anything
else in the block, tinted whenever it is *not* today.

Three quiet restatements of the same fact — a small grey line, a date box the
browser draws in its own locale, and the date repeated in the page description
— is how a day's work ends up filed against the wrong date.

**Two different dates deserve two columns.** When something was *entered* and
the day it was *filed against* are not the same, show both. An entry made on
the 9th against the 3rd is the shape of an honest correction and of a dishonest
one alike, and a screen showing only one of the dates cannot tell you it
happened.

## Say which span a number covers

A running total and a daily total on the same screen, both unlabelled, produce
a page that appears to contradict itself: "nothing sold today" above a row
reading "sold 1 L". Neither is wrong; they count different spans and nothing
says so. Put the span in the heading — "Everything bought and sold up to 09
Aug, not just today" — not in small print at the bottom.

## Let spacing do the grouping, and drop what it makes redundant

Where items belong to physical groups, the gap carries the grouping: a large
gap between groups against a small one inside. The heading then only names what
the spacing already showed, and the repeated prefix on each item can go.

## Use the words the business already uses

Not the words a bookkeeper would use, and not a literal translation. Where a
trade has its own vocabulary — a register's own terms for debit and credit, for
instance — **that word is the label** and the English is the gloss beside it,
not the other way round. The owner has been writing it by hand for years and no
phrasing invented in an interface will compete with it.

Rendering another script inside an English sentence: wrap it in `<bdi>` with
`lang` and `dir`, or the bidi algorithm drags the surrounding brackets around
it. Give it a size step up — most non-Latin scripts carry more detail per
character and do not survive 14px.

## A long instruction page is read by scanning

For any help or guide screen — opened for one answer, then closed:

- **A location chip instead of a sentence about where to go**, carrying the
  same icon as the nav tab so it points at something already on screen.
- **A rule leads with its claim in bold**, then explains. Ten short bold lines
  can be taken in; ten paragraphs behind ten identical warning icons cannot.
- **Fold away what is done once.** A native `<details>` — no JavaScript, no
  state, still found by the browser's own search.
- **Split cards by how often they are used**, not by subject.

A marker costs vertical space and buys scanning speed; expect the page to get
*longer* before the folding pays for it.

## Navigation

A column down the side beats a row of tabs past about eight sections — laid out
sideways they either scroll, hiding the last two on every laptop, or wrap onto
a second row that eats the top of every screen.

**Count the height when you add the ninth item.** A nav that overflows by eight
pixels gets a permanent scrollbar slab down its side on Windows. Trim the item
height and the identity block before reaching for `overflow: hidden` — and do
not reach for it at all if Sign out is the last item, because a list that
silently ends above it leaves the owner unable to sign out with nothing on
screen to say why. Keep the scroll, style it to a hairline, and make sure it
only fires on genuinely short windows.
