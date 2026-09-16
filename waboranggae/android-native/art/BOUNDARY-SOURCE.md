# 전남 지도 아트

- Source: Natural Earth, distributed by geoBoundaries (KR-46, South Jeolla).
- Dataset: KOR ADM1, represented year 2021, geoBoundaries revision 9469f09.
- Metadata: https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM1/
- License stated by dataset: Public Domain.
- Terms: https://www.naturalearthdata.com/about/terms-of-use/
- Original SHA-256: 6683cd1ad991676d96493fd0aae068215426497ccf82c8b0eb5683cad341cddc.

The checked-in GeoJSON is the KR-46 feature extracted without geometry edits.
The icon and splash use an aspect-corrected equirectangular projection of its rings,
using only the largest mainland polygon (detached islands omitted from artwork) and retaining the Gwangju exclusion. This is a generalized cartographic
boundary, not cadastral/survey data. Decorative landmark badges are approximate.
Walking-person artwork and footprints retain the app's existing vector design.

Regenerate: node android-native/tools/sync-web-art.mjs
Only for refreshing the pinned public source: node android-native/tools/jeonnam-art.mjs --fetch

Home background uses the exact Unsplash image URL from GitHub ver4.
It is a generic mountain photograph, not a verified photograph of Jeonnam;
do not label it as Korea Tourism Organization imagery.
