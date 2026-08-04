# public/

Files here are served from the site root: `public/logo.png` is `/logo.png`.

## logo.png

The mark shown in the navbar and on the login screen, next to the business
name. Save the logo here as `logo.png`.

* Square works best — it is drawn into a square box with `object-contain`, so a
  wider image is letterboxed rather than stretched.
* A transparent PNG sits better on the white header than one with a white
  background.
* ~256px is plenty; it is displayed at 36px in the navbar and 48px on login.

Nothing breaks while it is missing. `BrandMark` falls back to an initials tile,
so the header still looks deliberate — see `app/_components/ui/BrandMark.js`.

To change which file is used, edit `LOGO_SRC` in `app/_lib/brand.js`.
