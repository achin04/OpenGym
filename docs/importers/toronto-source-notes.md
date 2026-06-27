# Toronto Drop-in Source Notes

Inspection date: 2026-06-25

Source dataset: Registered Programs and Drop In Courses Offering

Package ID: `1a5be46a-4039-48cd-a2d2-8e702abf9516`

Package metadata endpoint:
`https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=1a5be46a-4039-48cd-a2d2-8e702abf9516`

Dataset page:
`https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/`

## Inspection Method

The inspection script is `scripts/inspect-toronto-ckan.ts`.

The script:

- fetches `package_show`;
- checks HTTP status and CKAN `success`;
- lists resources and DataStore status;
- samples DataStore field names and records;
- pages through the full Drop-in DataStore resource with a page size of 5,000;
- filters basketball records locally from the complete Drop-in snapshot;
- saves compact fixtures under `tests/fixtures/toronto/`.

The CKAN `datastore_search_sql` action returned 404 on this host during inspection, so the script does not depend on it. A `datastore_search?q=Basketball` request returned zero matches despite basketball rows existing, so the script also does not depend on `q` for basketball discovery.

## Current Package Metadata

Package title: `Registered Programs and Drop In Courses Offering`

Package name: `registered-programs-and-drop-in-courses-offering`

Package metadata modified: `2026-06-18T21:39:09.932915`

## Current DataStore Resources

The package has 16 resources. The active DataStore resources are:

| Logical table | Resource name | Resource ID | Format | DataStore active | Metadata modified |
| --- | --- | --- | --- | --- | --- |
| Locations | `Locations` | `f23ac1ad-6f46-4b59-811f-eb34be9b1f7a` | XLSX | true | `2026-06-18T21:37:27.795981` |
| Drop-in | `Drop-in` | `c99ec04f-4540-482c-9ee4-efb38774eab4` | XLSX | true | `2026-06-18T21:39:09.568011` |
| Facilities | `Facilities` | `e16505dc-f106-4b58-a689-ed0a2b8b0b69` | XLSX | true | `2026-06-18T21:37:59.302365` |
| Registered Programs | `Registered Programs` | `3bdfdad5-b1d0-4b1b-b56d-c61c317da306` | XLSX | true | `2026-06-18T21:38:35.237033` |

The CSV, XML, and JSON resources for these tables were present but had `datastore_active: false`. The importer should discover resources by name, `datastore_active`, and expected fields rather than relying on array order or downloadable file variants.

## Drop-in Resource

Resource ID: `c99ec04f-4540-482c-9ee4-efb38774eab4`

Total records during inspection: `31,928`

Fields:

- `_id` (`int`)
- `Location ID` (`int4`)
- `Course_ID` (`int4`)
- `Course Title` (`text`)
- `Section` (`text`)
- `Age Min` (`text`)
- `Age Max` (`text`)
- `Date Range` (`text`)
- `Start Hour` (`int4`)
- `Start Minute` (`int4`)
- `End Hour` (`int4`)
- `End Min` (`int4`)
- `First Date` (`date`)
- `Last Date` (`date`)
- `DayOftheWeek` (`text`)

Basketball records found by local title filtering: `1,002`

Basketball title counts:

| Course Title | Count |
| --- | ---: |
| `Basketball` | 919 |
| `Basketball (Girls)` | 6 |
| `Basketball (Men)` | 9 |
| `Basketball (Women)` | 29 |
| `Basketball with Family` | 33 |
| `Parasport: Wheelchair Basketball` | 6 |

All 1,002 basketball rows in this snapshot had `First Date` equal to `Last Date`, so current basketball Drop-in rows behave like individual scheduled occurrences rather than recurring ranges. The importer should still validate this invariant and fail or skip unexpected multi-date rows until the semantics are deliberately handled.

No basketball rows in this snapshot were missing `Course_ID` or `Location ID`.

No basketball rows in this snapshot had an end clock time earlier than or equal to the start clock time.

Observed basketball `Section` values:

| Section | Count |
| --- | ---: |
| `Sports - Drop-In` | 956 |
| `Reserve a Spot - Sports` | 27 |
| `EYS - Sports Drop-In` | 19 |

The Drop-in resource does not currently expose registration status, capacity, price, room, facility ID, or cancellation status fields. It does expose `Section`, which may be useful as source metadata and possibly description context.

Source dates are timezone-free local dates with separate hour and minute fields. The importer should interpret them as `America/Toronto` local times and store UTC `DateTime` values.

## Ages

`Age Min` and `Age Max` are text fields. Numeric values appear to represent ages in years. Open-ended maximum age is represented by the string `None`.

Observed basketball `Age Min` values include `4`, `6`, `9`, `10`, `12`, `13`, `15`, `16`, `17`, `18`, `19`, and `60`.

Observed basketball `Age Max` values include numeric values and `None`.

The importer should preserve the original min/max values separately from coarse `AgeGroup` mapping.

## Locations Resource

Resource ID: `f23ac1ad-6f46-4b59-811f-eb34be9b1f7a`

Total records during inspection: `1,922`

Fields:

- `_id` (`int`)
- `Location ID` (`int4`)
- `Parent Location ID` (`int4`)
- `Location Name` (`text`)
- `Location Type` (`text`)
- `Accessibility` (`text`)
- `Intersection` (`text`)
- `TTC Information` (`text`)
- `District` (`text`)
- `Street No` (`text`)
- `Street No Suffix` (`text`)
- `Street Name` (`text`)
- `Street Type` (`text`)
- `Street Direction` (`text`)
- `Postal Code` (`text`)
- `Description` (`text`)

The saved locations fixture contains locations referenced by representative basketball rows. Some optional values are represented by the string `None`, including some postal codes and street-type fields.

Address construction will need to combine `Street No`, optional `Street No Suffix`, `Street Name`, `Street Type`, and `Street Direction`, while treating `None` as missing.

Official facility page URL pattern:
`https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id={LOCATION_ID}`

## Facilities Resource

Resource ID: `e16505dc-f106-4b58-a689-ed0a2b8b0b69`

Total records during inspection: `9,825`

Fields:

- `_id` (`int`)
- `Facility ID` (`int4`)
- `Location ID` (`int4`)
- `Facility Type (Display Name)` (`text`)
- `Permit` (`text`)
- `FacilityType` (`text`)
- `Facility Rating` (`text`)
- `Asset Name` (`text`)

Facilities relate to Locations through `Location ID`. Drop-in rows currently contain `Location ID` but not `Facility ID`, so Facilities may be useful later for enrichment but are not enough to identify a specific room or gym for a Drop-in occurrence.

## Fixture Coverage

Saved fixtures:

- `tests/fixtures/toronto/package-show.json`
- `tests/fixtures/toronto/drop-in-sample.json`
- `tests/fixtures/toronto/locations-sample.json`
- `tests/fixtures/toronto/facilities-sample.json`

`drop-in-sample.json` includes representative rows for:

- ordinary `Basketball`;
- `Basketball (Girls)`;
- `Basketball (Men)`;
- `Basketball (Women)`;
- `Basketball with Family`;
- `Parasport: Wheelchair Basketball`;
- youth, adult, senior, and family age ranges;
- multiple locations;
- multiple dates;
- open-ended age max values represented as `None`.

No synthetic fixture was needed for the requested basketball title variants because all variants were present in the live source.

## Answers From Inspection

What are the exact current resource names?

- `Locations`
- `Drop-in`
- `Facilities`
- `Registered Programs`
- plus inactive CSV, XML, and JSON resources for those logical tables.

Which resources have `datastore_active: true`?

- `Locations`
- `Drop-in`
- `Facilities`
- `Registered Programs`

What are the exact field names?

- See the Drop-in, Locations, and Facilities sections above.

Are ages expressed in years?

- Yes, based on observed numeric age values and City recreation context. They arrive as text and must be parsed carefully. `None` means an open-ended maximum.

Does each Drop-in row represent one occurrence or a recurring range?

- Current basketball rows appear to represent one occurrence. All inspected basketball rows had `First Date` equal to `Last Date`.

Are `First Date` and `Last Date` usually equal?

- For basketball rows in this snapshot, yes: `1,002` equal and `0` different.

Does the Drop-in resource contain category or section?

- It contains `Section`. It does not contain a separate category field.

Does it contain registration status, capacity, price, or room?

- No such fields were present in the current Drop-in schema.

How does the Facilities table relate to Drop-in and Locations?

- Facilities rows have `Location ID`. Drop-in rows also have `Location ID`. Drop-in rows do not include `Facility ID`, so the relationship is location-level, not occurrence-to-room-level.

Are source dates timezone-free local values?

- Yes. Dates are date-only strings and clock values are split into hour/minute columns, with no offset or timezone field. Treat them as Toronto-local source values.
