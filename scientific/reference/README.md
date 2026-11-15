# Historical Horizons references

The twelve text files in `horizons/` are the public JPL Horizons responses
previously cached for six study points and Sun/Earth at five UTC instants:
2027-03-01 00:00, 2027-03-08 06:00, 2027-03-20 12:00,
2027-04-05 18:00 and 2027-04-27 23:00.

They were copied from the existing cache without making new API requests.
They contain the raw service response and numerical payload, normalized to LF.
They contain no local user paths, credentials, request authorization headers,
or personal request identifiers. Standard public service/author contact details
in a Horizons response remain part of the reference.

Each file name is the existing cache key (target, longitude, latitude,
observer altitude, and the SHA-1 prefix identifying the five requested times).
`scientific/validate.py` records the exact query convention; file SHA-256 values
are pinned in `scientific/source-lock.json`. V1 uses these references when no
identical private cache entry exists. The rebuild does not call Horizons.

Sources: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/),
[API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html).
These are independent sampled direction comparisons in the original interval.
They do **not** validate every date in expanded coverage, eclipse fractions,
planet directions, the terrain model, energy, or mission operations.
