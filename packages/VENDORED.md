# Packages from dotlife

`shared`, `sync`, `tasks`, `calendar-core`, `event-data` and `prayer-times` are copies of the
same packages in [dotlife](https://github.com/mostafauxd-cmyk/dotlife) at commit `8db30e21074745255f605abc1dd50fa1c67bba3d` (main).
The extension must follow exactly the app's sync rules and data model, so these are never edited
here: change them in dotlife, then copy them again with `scripts/vendor-dotlife.sh <dotlife checkout>`.

`ads` (`@dotlife/ads`) is a copy of NX Ads' model, whose home is the separate **nx-ads** repo (the
ads panel and `packages/ads`). Change it there, then copy it here; the new tab only reads it.
