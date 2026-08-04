# public/

Files here are served from the site root: `public/logo.png` is `/logo.png`.

## logo.png

The mark shown in the navbar and on the login screen, next to the business name.
Supplied by hand — save the green version here.

Use the green one on purpose: this sits on a white header, where a transparent
mark floats and a solid tile reads as a logo. The tab icon is the opposite case
and is transparent, because it sits on browser chrome that changes colour with
the theme. The two wanting opposite things is why they are separate files.

Keep it small. It is displayed at 36px in the navbar and 48px on login, so a few
hundred pixels wide is ample — the 1.1 MB original was being downloaded in full
on every page load to be drawn at 36px. Trimming the empty margin around the
mark helps too: it takes nothing off the logo and lets it fill the space.

## Browser icons

`app/favicon.ico`, `app/icon.png` and `app/apple-icon.png` are **generated** —
do not hand-edit them:

```sh
pip install pillow
python3 scripts/build-icons.py --source path/to/transparent-logo.png \
    --margin 0 --bleed 0.08
```

There is also a `--tile "#28ac28"` option, which writes `public/logo.png` as the
mark centred on a coloured tile. Not used — the logo is supplied by hand — but
it is there if you would rather generate it. Give it the **transparent** source
either way: the tile colour is added by the script, and a logo with a background
already baked in cannot be un-backgrounded.

Next.js picks all three up from `app/` by filename; there is nothing to wire up.

### Why a script rather than renaming the logo to favicon.ico

Because that is what was there before, and it looked tiny in the tab. Two
reasons, and the script explains both in its own header:

* **Padding.** The logo was centred in a square canvas with wide empty margins.
  A browser draws a favicon at 16px, so a mark covering 57% of the canvas height
  was being drawn about 9px tall inside a 16px box. Removing the empty margin —
  which takes nothing off the logo itself — draws it at ~11.6px instead.
* **File size.** `favicon.ico` was a 1.1 MB PNG with the extension changed. The
  generated one is a real multi-size ICO at ~7 KB.

### The whole logo is used, "go" included

Worth knowing what that costs, so nobody "fixes" it later by accident. The
lockup is 1.37:1, so in a square icon it is limited by its width: 16 wide by 12
tall is the geometric maximum, and those pixels are shared between the flower
and the wordmark. At 16px "go" reads as a red mark rather than as letters. It
sharpens up at 32px and above — retina tabs, bookmarks, history.

`--margin 0` and `--bleed 0.08` are doing real work here: they take it from 45%
of the icon to 85%. Do not drop them.

`--symbol-only` keeps the flower and drops the wordmark. That fills 88% and
stays a shape you can name at any size, which is why most brands' tab icons are
a symbol rather than a lockup. It is **deliberately not used** — the whole logo
was wanted.

### Sharpening

Each ICO size is sharpened **after** it is resized, at its own scale, which is
why the icons are packed by hand rather than by Pillow's `save(sizes=...)` —
that resizes internally from one image and treats every size the same. A 16px
icon needs the sharpening badly and a 48px one barely. It makes more difference
to legibility than size does.
