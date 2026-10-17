#!/usr/bin/env python3
"""Turn the visa-matrix dataset into the compact file the site reads (data/visa.json).

Usage:
    python3 tools/build_visa.py path/to/visa-matrix.json

The site needs one thing per passport and destination: which kind of door it is.
Each passport becomes a string with one letter per destination, in the order of
the "codes" list:

    F visa free          M freedom of movement   A visa on arrival
    T electronic travel authorisation (eTA)      E e-Visa
    R visa required      X entry refused         - own country

Pairs where the two underlying sources disagree are listed under "disputed",
so the site can say "sources differ" instead of hiding it.

Manual fixes for policy changes the sources have not caught up with go in
data/corrections.json and are applied last.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "visa.json"
CORRECTIONS = ROOT / "data" / "corrections.json"

LETTER = {
    "visa-free": "F",
    "freedom-of-movement": "M",
    "visa-on-arrival": "A",
    "eta": "T",
    "e-visa": "E",
    "visa-required": "R",
    "refused": "X",
}

# Display names. Short common forms, using UN names where they differ
# (Türkiye, Czechia, Myanmar), and Henley's names for the three places
# that are not UN member states but issue their own travel documents.
NAMES = {
    "AD": "Andorra", "AE": "United Arab Emirates", "AF": "Afghanistan", "AG": "Antigua and Barbuda",
    "AL": "Albania", "AM": "Armenia", "AO": "Angola", "AR": "Argentina", "AT": "Austria",
    "AU": "Australia", "AZ": "Azerbaijan", "BA": "Bosnia and Herzegovina", "BB": "Barbados",
    "BD": "Bangladesh", "BE": "Belgium", "BF": "Burkina Faso", "BG": "Bulgaria", "BH": "Bahrain",
    "BI": "Burundi", "BJ": "Benin", "BN": "Brunei", "BO": "Bolivia", "BR": "Brazil",
    "BS": "Bahamas", "BT": "Bhutan", "BW": "Botswana", "BY": "Belarus", "BZ": "Belize",
    "CA": "Canada", "CD": "DR Congo", "CF": "Central African Republic", "CG": "Republic of the Congo",
    "CH": "Switzerland", "CI": "Côte d'Ivoire", "CL": "Chile", "CM": "Cameroon", "CN": "China",
    "CO": "Colombia", "CR": "Costa Rica", "CU": "Cuba", "CV": "Cabo Verde", "CY": "Cyprus",
    "CZ": "Czechia", "DE": "Germany", "DJ": "Djibouti", "DK": "Denmark", "DM": "Dominica",
    "DO": "Dominican Republic", "DZ": "Algeria", "EC": "Ecuador", "EE": "Estonia", "EG": "Egypt",
    "ER": "Eritrea", "ES": "Spain", "ET": "Ethiopia", "FI": "Finland", "FJ": "Fiji",
    "FM": "Micronesia", "FR": "France", "GA": "Gabon", "GB": "United Kingdom", "GD": "Grenada",
    "GE": "Georgia", "GH": "Ghana", "GM": "Gambia", "GN": "Guinea", "GQ": "Equatorial Guinea",
    "GR": "Greece", "GT": "Guatemala", "GW": "Guinea-Bissau", "GY": "Guyana",
    "HK": "Hong Kong (SAR China)", "HN": "Honduras", "HR": "Croatia", "HT": "Haiti",
    "HU": "Hungary", "ID": "Indonesia", "IE": "Ireland", "IL": "Israel", "IN": "India",
    "IQ": "Iraq", "IR": "Iran", "IS": "Iceland", "IT": "Italy", "JM": "Jamaica", "JO": "Jordan",
    "JP": "Japan", "KE": "Kenya", "KG": "Kyrgyzstan", "KH": "Cambodia", "KI": "Kiribati",
    "KM": "Comoros", "KN": "Saint Kitts and Nevis", "KP": "North Korea", "KR": "South Korea",
    "KW": "Kuwait", "KZ": "Kazakhstan", "LA": "Laos", "LB": "Lebanon", "LC": "Saint Lucia",
    "LI": "Liechtenstein", "LK": "Sri Lanka", "LR": "Liberia", "LS": "Lesotho", "LT": "Lithuania",
    "LU": "Luxembourg", "LV": "Latvia", "LY": "Libya", "MA": "Morocco", "MC": "Monaco",
    "MD": "Moldova", "ME": "Montenegro", "MG": "Madagascar", "MH": "Marshall Islands",
    "MK": "North Macedonia", "ML": "Mali", "MM": "Myanmar", "MN": "Mongolia",
    "MO": "Macao (SAR China)", "MR": "Mauritania", "MT": "Malta", "MU": "Mauritius",
    "MV": "Maldives", "MW": "Malawi", "MX": "Mexico", "MY": "Malaysia", "MZ": "Mozambique",
    "NA": "Namibia", "NE": "Niger", "NG": "Nigeria", "NI": "Nicaragua", "NL": "Netherlands",
    "NO": "Norway", "NP": "Nepal", "NR": "Nauru", "NZ": "New Zealand", "OM": "Oman",
    "PA": "Panama", "PE": "Peru", "PG": "Papua New Guinea", "PH": "Philippines", "PK": "Pakistan",
    "PL": "Poland", "PS": "Palestine", "PT": "Portugal", "PW": "Palau", "PY": "Paraguay",
    "QA": "Qatar", "RO": "Romania", "RS": "Serbia", "RU": "Russia", "RW": "Rwanda",
    "SA": "Saudi Arabia", "SB": "Solomon Islands", "SC": "Seychelles", "SD": "Sudan",
    "SE": "Sweden", "SG": "Singapore", "SI": "Slovenia", "SK": "Slovakia", "SL": "Sierra Leone",
    "SM": "San Marino", "SN": "Senegal", "SO": "Somalia", "SR": "Suriname", "SS": "South Sudan",
    "ST": "São Tomé and Príncipe", "SV": "El Salvador", "SY": "Syria", "SZ": "Eswatini",
    "TD": "Chad", "TG": "Togo", "TH": "Thailand", "TJ": "Tajikistan", "TL": "Timor-Leste",
    "TM": "Turkmenistan", "TN": "Tunisia", "TO": "Tonga", "TR": "Türkiye",
    "TT": "Trinidad and Tobago", "TV": "Tuvalu", "TW": "Taiwan (Chinese Taipei)", "TZ": "Tanzania",
    "UA": "Ukraine", "UG": "Uganda", "US": "United States", "UY": "Uruguay", "UZ": "Uzbekistan",
    "VA": "Holy See", "VC": "Saint Vincent and the Grenadines", "VE": "Venezuela",
    "VN": "Viet Nam", "VU": "Vanuatu", "WS": "Samoa", "XK": "Kosovo", "YE": "Yemen",
    "ZA": "South Africa", "ZM": "Zambia", "ZW": "Zimbabwe",
}

# Other names people type into the search box.
ALIASES = {
    "US": ["USA", "America", "United States of America"],
    "GB": ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    "AE": ["UAE", "Dubai", "Abu Dhabi", "Emirates"],
    "TR": ["Turkey", "Turkiye"], "MM": ["Burma"], "CI": ["Ivory Coast"], "CZ": ["Czech Republic"],
    "SZ": ["Swaziland"], "TL": ["East Timor"], "CV": ["Cape Verde"], "NL": ["Holland"],
    "KR": ["Korea", "Republic of Korea"], "KP": ["DPRK"], "CD": ["DRC", "Congo-Kinshasa", "Zaire"],
    "CG": ["Congo-Brazzaville", "Congo"], "VA": ["Vatican", "Vatican City"], "MK": ["Macedonia"],
    "RU": ["Russian Federation"], "LA": ["Lao PDR"], "VN": ["Vietnam"], "BN": ["Brunei Darussalam"],
    "FM": ["Federated States of Micronesia"], "HK": ["Hong Kong"], "MO": ["Macau", "Macao"],
    "TW": ["Taiwan", "Chinese Taipei"], "PS": ["State of Palestine"], "IR": ["Persia"],
    "BS": ["The Bahamas"], "GM": ["The Gambia"], "SA": ["KSA"], "BA": ["Bosnia"],
    "KN": ["St Kitts"], "LC": ["St Lucia"], "VC": ["St Vincent"],
}


def main(src: str) -> None:
    data = json.loads(pathlib.Path(src).read_text(encoding="utf-8"))
    matrix = data["matrix"]
    checked = data.get("meta", {}).get("generated", "")

    corrections = []
    if CORRECTIONS.exists():
        corrections = json.loads(CORRECTIONS.read_text(encoding="utf-8")).get("corrections", [])
    for fix in corrections:
        cell = matrix.setdefault(fix["passport"], {}).setdefault(fix["destination"], {})
        cell["type"] = fix["type"]
        cell["confidence"] = "high"
        cell.pop("dispute", None)

    codes = sorted(set(matrix) | {d for row in matrix.values() for d in row})
    unknown = [c for c in codes if c not in NAMES]
    if unknown:
        sys.exit(f"Add display names for: {', '.join(unknown)}")

    doors, disputed = {}, {}
    for p in sorted(matrix):
        row = matrix[p]
        letters, flagged = [], []
        for d in codes:
            if d == p:
                letters.append("-")
                continue
            cell = row.get(d)
            if not cell or cell.get("type") not in LETTER:
                sys.exit(f"Missing or unknown entry type for {p} -> {d}: {cell}")
            letters.append(LETTER[cell["type"]])
            if cell.get("confidence") == "disputed":
                flagged.append(d)
        doors[p] = "".join(letters)
        if flagged:
            disputed[p] = "".join(flagged)

    out = {
        "checked": checked,
        "source": "visa-matrix: Wikipedia visa requirement pages, cross-checked with Passport Index",
        "license": "CC BY-SA 4.0",
        "corrections": len(corrections),
        "codes": codes,
        "names": [NAMES[c] for c in codes],
        "aliases": {c: ALIASES[c] for c in codes if c in ALIASES},
        "doors": doors,
        "disputed": disputed,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB): {len(doors)} passports, checked {checked}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
