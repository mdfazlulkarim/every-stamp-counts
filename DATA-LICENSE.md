# Data sources and licences

| File | Source | Licence |
|---|---|---|
| `data/visa.json` | [visa-matrix](https://github.com/xpressmike/visa-matrix), built from the English Wikipedia "Visa requirements for ... citizens" pages and cross-checked with [Passport Index](https://www.passportindex.org) data via [passport-index-data](https://github.com/imorte/passport-index-data) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credit: visa-matrix, Wikipedia contributors, Passport Index. Changes: converted to a compact format and corrected through `data/corrections.json`. Anyone who reuses this file must share it under the same licence. |
| `data/corrections.json` | Manual corrections, each with its official source | CC BY-SA 4.0 |
| `data/world.json` | [Natural Earth](https://www.naturalearthdata.com) (public domain), through [world-atlas](https://github.com/topojson/world-atlas) (ISC licence), with Natural Earth disputed-area shapes | Public domain map data. Simplified, keyed by ISO 3166-1 codes, and redrawn to follow United Nations map conventions (see `tools/build_map.js`). |
| `flags/` | [flag-icons](https://github.com/lipis/flag-icons) | MIT licence |
| `data/henley.json` | [Henley Passport Index](https://www.henleyglobal.com) by Henley & Partners, based on IATA data | © Henley & Partners. Used with attribution on a non-commercial awareness site. Figures are entered by hand from the published ranking; they are never collected automatically. |

The boundaries and names shown on the map do not imply official endorsement or acceptance.
