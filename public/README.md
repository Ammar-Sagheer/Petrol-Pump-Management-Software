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
    --symbol-only --margin 0.02
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

### Why the icons are the flower and not the whole logo

Because the whole logo cannot be read at 16px, and no amount of scaling fixes
it. Put the tab next to any other site — Vercel's triangle, Gmail's M,
Supabase's lightning — and they are all **one bold shape filling the square**.
The lockup is two elements in thin outline at 1.37:1, so in a square icon it is
limited by its width: 16 wide by 13 tall at best, and those 13 pixels are split
between a green smudge and a red one.

The flower alone is 1.05:1, so it fills 16x16, and it stays a recognisable shape
all the way down. It fills 88% of the icon against the lockup's 73%.

"go" is not lost — it is on the navbar, the login screen and the monthly report,
everywhere there is room to read it. The tab is the one place it cannot survive.
Drop `--symbol-only` to put it back.

### Sharpening

Each ICO size is sharpened **after** it is resized, at its own scale, which is
why the icons are packed by hand rather than by Pillow's `save(sizes=...)` —
that resizes internally from one image and treats every size the same. A 16px
icon needs the sharpening badly and a 48px one barely. It makes more difference
to legibility than size does.
