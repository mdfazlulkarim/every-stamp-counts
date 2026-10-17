# Every Stamp Counts

**Same world, different doors.**

Some passports open most of the world without paperwork. Others need a visa application for almost every trip. Every Stamp Counts lets anyone choose their passport, add the countries they have visited, and see the effort behind their journey, then compare the same journey with any other passport.

Live site: https://mdfazlulkarim.github.io/every-stamp-counts/

This is an independent, non-commercial awareness project. It is not a United Nations product and is not endorsed by the United Nations. Visa rules change often, so always confirm with the destination's authorities before you travel.

## How the score works

Each country visited earns points for the door the traveller's passport meets there. The more paperwork a door needs, the more points it earns, so a higher score means more effort went into the journey.

| Door | What it means | Points |
|---|---|---:|
| Open door | Visa free, or freedom of movement | 1 |
| Quick formality | Visa on arrival, or an electronic travel authorisation (eTA) | 2 |
| Online visa | An e-Visa, applied for and approved before travel | 3 |
| Embassy visa | A visa applied for through an embassy, consulate or visa centre | 6 |

The site also shows how many of 198 countries each passport can enter without a prior visa, and the passport's official rank in the Henley Passport Index.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole site: layout, styles and script in one file |
| `data/visa.json` | Entry rules for every passport and destination, in a compact format |
| `data/henley.json` | Official Henley Passport Index ranks, entered by hand |
| `data/corrections.json` | Manual fixes for rule changes the sources have not caught up with |
| `data/world.json` | The world map, drawn to follow United Nations map conventions |
| `flags/` | Country flags from flag-icons |
| `tools/build_visa.py` | Converts the visa-matrix dataset into `data/visa.json` |
| `tools/build_map.js` | Rebuilds `data/world.json` from Natural Earth (one-off; see the notes at the top of the script) |
| `.github/workflows/refresh-visa-data.yml` | Monthly refresh of the visa rules |

## Keeping the data current

**Visa rules (automatic, monthly).** On the 3rd of each month a GitHub Action rebuilds the rules from Wikipedia and Passport Index and opens a pull request if anything changed. Review it and merge. For this to work, turn on *Settings > Actions > General > Workflow permissions > Allow GitHub Actions to create and approve pull requests*. You can also run it any time from the *Actions* tab.

**Corrections.** When someone reports a changed rule, add it to `data/corrections.json` with the official source and the date it took effect, then run:

```
git clone --depth 1 https://github.com/xpressmike/visa-matrix.git upstream
python3 tools/build_visa.py upstream/data/visa-matrix.json
```

**Henley ranks (by hand, quarterly).** Henley publishes a new ranking in January, April, July and October. Update `edition`, `published` and `ranks` in `data/henley.json` from the published table. Each entry is `"ISO code": [rank, destinations]`, for example `"SG": [1, 193]`. Henley's terms of use do not allow automated collection, so never script this.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. The page loads its data with `fetch`, so opening `index.html` directly from disk will not work.

## Publish with GitHub Pages

*Settings > Pages > Build and deployment*: choose *Deploy from a branch*, branch `main`, folder `/ (root)`.

## Licences

Code: MIT (see `LICENSE`). Data and flags: see `DATA-LICENSE.md`. The visa data is CC BY-SA 4.0, credited to visa-matrix, Wikipedia contributors and Passport Index. Henley Passport Index figures are © Henley & Partners and are used with attribution on a non-commercial site. The boundaries and names shown on the map do not imply official endorsement or acceptance.
