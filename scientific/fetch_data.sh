#!/usr/bin/env bash
# Download the public inputs into scientific/cache/ (~520 MB). Not versioned.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p cache/kernels cache/dem
N=https://naif.jpl.nasa.gov/pub/naif/generic_kernels
(cd cache/kernels && for u in lsk/naif0012.tls pck/pck00011.tpc spk/planets/de440s.bsp \
   pck/moon_pa_de440_200625.bpc fk/satellites/moon_de440_250416.tf; do curl -fLO "$N/$u"; done)
I=https://imbrium.mit.edu
(cd cache/dem && for f in DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M \
   EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608 EXTRAS/ILLUMINATION/IMG/LPSR_85S_060M_201608; do
   curl -fLO "$I/$f.IMG"; curl -fLO "$I/$f.LBL"; done)
P=https://pgda.gsfc.nasa.gov/data/LOLA_5mpp
for s in Site01 Site04 Site06 Site23; do
  mkdir -p cache/dem/$s
  (cd cache/dem/$s && curl -fLO "$P/$s/${s}_final_adj_5mpp_surf.tif")
done
# Visual-only inputs (globe relief and star background), NASA SVS:
mkdir -p cache/svs
curl -fL -o cache/svs/ldem_4.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif
curl -fL -o cache/svs/starmap_2020_4k.exr https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr
curl -fL -o cache/svs/lroc_color_16bit_srgb_4k.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif
# Verify a real binary was received (some PGDA links return an HTML page with HTTP 200).
for f in cache/dem/*/*.tif; do head -c 4 "$f" | grep -q "II" || { echo "Not a TIFF: $f"; exit 1; }; done
echo "Inputs ready. Then run: PYTHONPATH=. python -P build_scenes.py && PYTHONPATH=. python -P validate.py --horizons"
