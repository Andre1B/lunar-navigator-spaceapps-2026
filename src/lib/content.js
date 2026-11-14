export const chapters = [
  {
    title: "Your mission begins.",
    minutes: "1 minute",
    body: "You are reviewing a lunar surface mission. Your task is to find a location and arrival window with useful sunlight and direct Earth visibility. These are educational scenarios, not approved mission requirements.",
    action: "Locate your point of interest",
    route: "simulator",
    question:
      "Before you move time: do you expect a high ridge or a crater floor to see more of the low polar Sun?",
  },
  {
    title: "A small ridge. A hidden Sun.",
    minutes: "2 minutes",
    body: "At the lunar south pole, terrain can interrupt a line of sight near the horizon. Inspect the actual horizon profile, then advance time. Watch the Sun cross terrain rather than an imaginary flat edge.",
    action: "Inspect the horizon",
    route: "compare",
    question:
      "Find a time when the Sun is above the geometric horizon but partly or completely hidden by terrain.",
  },
  {
    title: "Light is only half the plan.",
    minutes: "2 minutes",
    body: "A sunlit location may still lose its direct view of Earth. Compare the two timelines. Visibility of any part of Earth is a geometric indicator, not a guarantee that a ground station can receive a signal.",
    action: "Compare light and Earth visibility",
    route: "compare",
    question:
      "Does the brightest location also have the shortest gaps in Earth visibility?",
  },
  {
    title: "The landing is delayed.",
    minutes: "3 minutes",
    body: "The arrival date changes. Test a delay, keep the operating duration fixed and compare your original location with another point. Examine both the benefit and the cost of changing the plan.",
    action: "Test your delay",
    route: "compare",
    question:
      "Would you change the location or accept a different window? Explain the trade-off using the measured intervals.",
  },
  {
    title: "Make a decision you can explain.",
    minutes: "2 minutes",
    body: "A result is useful when someone else can check it. Review your scenarios, observer height, data coverage and verification evidence. Identify one limitation that could change your conclusion.",
    action: "Open the evidence",
    route: "evidence",
    question: "Which observation would make you revise your recommendation?",
  },
];
export const sources = [
  {
    title: "NASA Deep Star Maps 2020",
    url: "https://svs.gsfc.nasa.gov/4851/",
    use: "J2000 catalogue star positions. NASA/Goddard Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC. Brightness and colour are illustrative, not a photometric prediction. Conversion and source hashes are in data/starmap/starmap.json.",
  },
  {
    title: "NASA Blue Marble Next Generation",
    url: "https://svs.gsfc.nasa.gov/12564/",
    use: "Historical March 2004 Earth appearance. Credit: NASA’s Goddard Space Flight Center; data courtesy of Reto Stockli (NASA/GSFC). Not 2027 weather; Earth rotation uses a visual-only low-precision IAU model.",
  },
  {
    title: "JPL Horizons",
    url: "https://ssd.jpl.nasa.gov/horizons/",
    use: "Independent ephemeris reference for checking selected Sun and Earth positions. Query results and checks are documented with the dataset.",
  },
  {
    title: "LRO / LOLA and PGDA",
    url: "https://pgda.gsfc.nasa.gov/products/78",
    use: "Published lunar terrain used to calculate the local horizon. Dataset manifest identifies products, coordinates and checksums.",
  },
  {
    title: "NASA CGI Moon Kit",
    url: "https://svs.gsfc.nasa.gov/4720/",
    use: "LROC-derived surface appearance for the globe. Credit: NASA’s Scientific Visualization Studio; Ernie Wright (STC), Noah Petro (NASA/GSFC). Visual texture is not the numerical polar elevation model.",
  },
  {
    title: "NAIF SPICE",
    url: "https://naif.jpl.nasa.gov/naif/",
    use: "Offline astronomical positions and body orientations. Kernel files and their versions are recorded in the manifest.",
  },
  {
    title: "LROC QuickMap",
    url: "https://quickmap.lroc.im-ldi.com/",
    use: "Official challenge resource and exploration reference; not a runtime dependency.",
  },
  {
    title: "NASA Moon Trek",
    url: "https://trek.nasa.gov/moon/",
    use: "Official challenge resource and exploration reference; not a runtime dependency.",
  },
  {
    title: "Canadian Space Agency — Moon exploration",
    url: "https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/",
    use: "Context on lunar exploration. Contextual reference, not a source of our numerical visibility results.",
  },
];
export const scientificSoftware = [
  {
    name: "Pillow",
    version: "optional conversion tool",
    license: "HPND",
    repository: "https://github.com/python-pillow/Pillow",
    role: "Resizing and encoding credited visual assets",
  },
  {
    name: "OpenEXR",
    version: "optional conversion tool",
    license: "BSD-3-Clause",
    repository: "https://github.com/AcademySoftwareFoundation/openexr",
    role: "Reading the NASA star-map source",
  },
  {
    name: "imagecodecs",
    version: "2026.11.11",
    license: "BSD-3-Clause",
    repository: "https://github.com/cgohlke/imagecodecs",
    role: "Decoding the source LROC TIFF",
  },
  {
    name: "Python",
    version: "3.12",
    license: "PSF License",
    repository: "https://github.com/python/cpython",
    role: "Scientific runtime",
  },
  {
    name: "NumPy",
    version: "2.5.3",
    license: "BSD-3-Clause",
    repository: "https://github.com/numpy/numpy",
    role: "Numerical arrays",
  },
  {
    name: "SpiceyPy",
    version: "8.4.0",
    license: "MIT; bundled CSPICE retains NAIF terms",
    repository: "https://github.com/AndrewAnnex/SpiceyPy",
    role: "Astronomical geometry",
  },
  {
    name: "tifffile",
    version: "2026.9.20",
    license: "BSD-3-Clause",
    repository: "https://github.com/cgohlke/tifffile",
    role: "Terrain raster reading",
  },
  {
    name: "PyShp",
    version: "3.1.8",
    license: "MIT",
    repository: "https://github.com/GeospatialPython/pyshp",
    role: "One-time exploration of published ROI shapefiles",
  },
  {
    name: "Overpass",
    version: "Fontsource distribution",
    license: "SIL Open Font License 1.1",
    repository: "https://github.com/RedHatOfficial/Overpass",
    role: "Interface typography",
  },
  {
    name: "Fira Code",
    version: "Fontsource distribution",
    license: "SIL Open Font License 1.1",
    repository: "https://github.com/tonsky/FiraCode",
    role: "Numerical typography",
  },
];
export const researchProjects = [
  [
    "Connected Earth Museum",
    "https://github.com/connected-earth/connected-earth-museum",
    "Guided scientific exploration",
  ],
  [
    "PureFlow 2025",
    "https://github.com/larasdiniz/PureFlow-2025",
    "Mission choices and visible consequences",
  ],
  [
    "42 Quake Heroes notebook",
    "https://github.com/gabrielchayb/42-model-source-notebook",
    "Inspectable methods and carefully defined metrics",
  ],
  [
    "CLPS Lunar Mission Browser",
    "https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser",
    "Related lunar-tool research",
  ],
  [
    "LuminaLuna",
    "https://github.com/Planet-Coders/lunar-landing-site-navigator",
    "Related lunar-tool research",
  ],
  [
    "Lunar Horizon",
    "https://github.com/localizedprojects/CLPS-MOON-BROWSER",
    "Related lunar-tool research",
  ],
];
