# public/

Files here are served from the site root: `public/logo.png` is `/logo.png`.

## logo.png

The mark shown in the navbar and on the login screen, next to the business name.

Use the **transparent** version. The header is white, so a logo with its own
background renders as a coloured tile sitting on it rather than as a logo.

Keep it small — it is displayed at 36px in the navbar and 48px on login, so a
few hundred pixels wide is ample. The 1.1 MB original was being downloaded in
full on every page load to be drawn at 36px.

## Browser icons

`app/favicon.ico`, `app/icon.png` and `app/apple-icon.png` are **generated** —
do not hand-edit them:

```sh
pip install pillow
python3 scripts/build-icons.py --source path/to/logo.png --margin 0
```

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

`--symbol-only` also exists, which keeps the flower and drops the wordmark. It
fills the tab far better (82% against 73%) because the flower is square where
the lockup is wide — but it loses "go", so it is not what is used here.
