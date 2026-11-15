// Teaching content for the "How it works" page. Plain English first, detail in disclosures.
// Every number below is a made-up teaching example, labelled as such on screen.
// None of it is NASA data and none of it comes from the dataset in public/data.

export const intro = {
  title: "How Lunacline works",
  lead: "Imagine a spacecraft lands near the Moon's south pole, but the landing slips by a few days. Will the spot still get sunlight? Can it still see Earth? This app lets you test that, and this page teaches you how to read the answers.",
  facts: [
    {
      q: "What is it?",
      a: "A comparison tool for landing delays near the lunar south pole. Pick a study point, an observer height, an arrival date and a delay: it calculates how long the Sun and Earth stay in view for each arrival, from published terrain and NASA/NAIF positions. The 3D view is an optional way to see the same sky.",
    },
    {
      q: "Who is it for?",
      a: "Curious people, students and teachers first. Reviewers can inspect the method and the checks in the Evidence screen.",
    },
    {
      q: "What can I do?",
      a: "Pick a point, move time, delay an arrival, compare two places and write down a decision you can explain.",
    },
  ],
};

export const toc = [
  ["raise", "Raise the observer"],
  ["shadow", "Shadow or night?"],
  ["modes", "Faithful or Free"],
  ["metrics", "Reading the numbers"],
  ["steps", "Use the app in 8 steps"],
  ["limits", "What it does not do"],
  ["sources", "Sources and AI"],
];

// Schematic only: unit-less distances, not a real lunar location.
export const raise = {
  title: "Raise the observer",
  intro:
    "On the Moon the Sun hugs the horizon, so a small ridge can hide it. Slide the height of the observer up and watch what the ridge does.",
  ridge: { distance: 60, height: 6 },
  sunElevation: 4, // degrees above the flat horizon, illustrative
  min: 0,
  max: 10,
  start: 1,
  hidden:
    "Hidden. The line toward the Sun touches the ridge first, so you are in terrain shadow even though the Sun is above the flat horizon.",
  visible:
    "Visible. Standing higher lifts your line of sight over the ridge, so the Sun appears.",
  detail:
    "The real app does this with 720 sight lines around each point and a terrain model, at five observer heights: 0.5, 1, 2, 5 and 10 m. The drawing here is a cartoon with made-up distances.",
};

export const shadow = {
  title: "Shadow, or no Sun at all?",
  intro:
    "Two very different things can make a place dark. Telling them apart is the heart of the app. Answer each question, then read the feedback.",
  questions: [
    {
      id: "a",
      scene:
        "The Sun is 2° above the flat horizon. A ridge in that direction rises 4° above the same flat horizon.",
      ask: "Can the observer see the Sun?",
      options: [
        {
          label: "Yes, it is above the horizon",
          right: false,
          why: "Not quite. The ridge stands higher in the sky (4°) than the Sun (2°), so the ridge blocks it. This is terrain shadow.",
        },
        {
          label: "No, the ridge hides it",
          right: true,
          why: "Right. The Sun is above the flat horizon but below the terrain horizon. The app calls this terrain-blocked, and it is the reason the app exists.",
        },
      ],
    },
    {
      id: "b",
      scene:
        "The Sun is 3° below the flat horizon. The ground around is perfectly flat.",
      ask: "What is the cause of the darkness?",
      options: [
        {
          label: "The Sun is simply below the horizon (night)",
          right: true,
          why: "Right. No terrain is involved. The Sun has not risen at that moment.",
        },
        {
          label: "A ridge is casting a shadow",
          right: false,
          why: "There is no ridge in this picture. The ground is flat, so the cause is plain night.",
        },
      ],
    },
    {
      id: "c",
      scene:
        "The globe on screen shows the whole Moon lit on one side and dark on the other.",
      ask: "Does that shading tell you whether a point is in a ridge's shadow?",
      options: [
        {
          label: "Yes, a lit globe means the point is in sunlight",
          right: false,
          why: "No. Globe shading only follows a smooth sphere. It cannot know about ridges and craters.",
        },
        {
          label: "No, only the terrain horizon can tell you",
          right: true,
          why: "Right. The app keeps these apart on purpose: globe shading is day/night on a smooth ball, while visibility uses the real terrain horizon.",
        },
      ],
    },
  ],
};

export const modes = {
  title: "Faithful or Free?",
  intro:
    "Faithful Mode is the real sky: every body sits where it truly is at one shared moment. Free Mode is a toy: you may freeze something while the rest moves on.",
  faithful: {
    name: "Faithful Mode",
    text: "One clock drives the Sun and Earth together. Use these calculated results for the comparison.",
  },
  free: {
    name: "Free Mode",
    text: "You can hold a position or orientation still. That creates a sky that never existed, so it is labeled experimental and gives no recommendation.",
  },
  freezeLabel: "Freeze Earth at this moment",
  detail:
    "Free Mode never changes any stored result. It only changes what you see, so you can build intuition for how each body moves.",
};

// Teaching example: 24 hourly samples of "fraction of the Sun's disc visible" (0 to 1).
const steady = [0.2, 0.2, 0.25, 0.25];
export const metrics = {
  title: "Reading the numbers",
  intro:
    "Two places can average the same amount of sunlight and still be very different to live with. Pick an example and watch each measure.",
  note: "Teaching examples only. The values are invented to show how the measures work, not real lunar data.",
  cases: [
    {
      id: "steady",
      label: "Steady and thin",
      blurb: "A little light, almost all day.",
      values: [
        ...steady,
        ...steady,
        ...steady,
        ...steady,
        ...steady,
        ...steady,
      ],
    },
    {
      id: "bursts",
      label: "Bright bursts",
      blurb: "Full Sun for a few hours, then a long dark stretch.",
      values: [...Array(8).fill(1), ...Array(16).fill(0)],
    },
  ],
  terms: [
    [
      "Mean Sun disc",
      "The average fraction of the Sun's face that is visible over the window. 1 means the whole face, 0 means none.",
    ],
    [
      "Direct sunlight",
      "How long some part of the Sun is visible. It says nothing about how bright.",
    ],
    [
      "Longest darkness",
      "The longest unbroken stretch with no Sun at all. Long darkness is often the real challenge.",
    ],
  ],
  detail:
    "In the app, the mean uses hourly samples, while start and end times of sunlit periods are found on a 5-minute grid and refined to about 1 minute. An event shorter than 5 minutes can be missed. A period that touches the edge of the study window is shown as a lower bound (≥), because it may continue beyond it.",
};

export const steps = [
  {
    title: "Pick a point",
    body: "Choose one of six points on published south-pole terrain. Two use published region centroids; four were selected by us, including two nearby points offset by about 1 km. They are not NASA-selected landing sites.",
    route: "compare",
    action: "Choose a point in Compare",
    more: "The original points are Connecting ridge, Shackleton rim, Nobile rim 1 and Malapert massif. Two additional points are neighbors of Connecting and Shackleton, selected by fixed coordinate offsets.",
  },
  {
    title: "Choose an observer height",
    body: "Choose 0.5, 1, 2, 5 or 10 m above the ground. A taller observer can see over small bumps.",
    more: "This is the same idea as the Raise the observer demo above.",
  },
  {
    title: "Set the arrival and the window",
    body: "Pick an arrival date and how long you plan to operate. The data covers a rolling period of about one year before and after the latest refresh; Compare shows the exact first and last dates.",
    more: "Dates are in UTC. The operating window stays the same length when you delay the arrival, so comparisons are fair.",
  },
  {
    title: "Delay the landing",
    body: "Slide the delay and see what changes. A delay moves the whole window later, it does not shorten it.",
  },
  {
    title: "Add an alternative place",
    body: "Compare your first point against another one using the very same dates and assumptions.",
    route: "compare",
    action: "Open Compare",
  },
  {
    title: "Watch the sky",
    body: "Open the simulator and switch to the surface view to see the Sun and Earth against the real terrain horizon. Use Play, Step +1 h and the timeline to move through time.",
    route: "simulator",
    action: "Open the simulator",
    more: "Dragging the camera only changes your view. It never changes a calculation. 'Explore space' hides the interface; a Return button and the Esc key bring it back.",
  },
  {
    title: "Read the results",
    body: "Look at the mean Sun disc, direct sunlight, longest darkness, Earth visibility and the longest gap without Earth in view.",
    more: "Earth visibility means a straight line of sight. It does not mean a working radio link.",
  },
  {
    title: "Explain a decision",
    body: "Write a short note: which place and window would you choose, and what do you give up? A good answer names a trade-off.",
    route: "mission",
    action: "Open the Guided analysis",
  },
];

export const limits = {
  title: "What this does not do",
  intro: "Being clear about limits is part of the science.",
  items: [
    [
      "No power or batteries",
      "Sunlight here is geometry. It is not electricity, heat or battery life.",
    ],
    [
      "No radio link",
      "Seeing Earth in a straight line is not a working connection. No NASA Deep Space Network schedule, relay or link budget is modeled.",
    ],
    [
      "No safety certification",
      "Nothing here says a place is safe to land. There are no hazard or slope checks.",
    ],
    [
      "No operational approval",
      "This is an educational prototype. It is not endorsed or certified by NASA.",
    ],
    [
      "Sampling limits",
      "Events shorter than 5 minutes can be missed, and only the stated period is covered.",
    ],
    [
      "Simplified Sun",
      "The Sun is treated as an evenly bright disc. Boulders and tiny relief are not modeled.",
    ],
  ],
};

export const sources = {
  title: "Where it comes from",
  blocks: [
    {
      title: "NASA data",
      text: "Terrain comes from public lunar laser-altimeter maps (LRO/LOLA, via PDS and PGDA). Sun, Earth and Moon positions come from NAIF SPICE. Selected angles are checked against JPL Horizons. The 3D globe uses NASA SVS/LROC imagery.",
    },
    {
      title: "Open source",
      text: "Original code is Apache-2.0. Other software keeps its own license. The Credits screen links the upstream source and license of every reused project and says whether it is a tool, data, a reference or inspiration.",
    },
    {
      title: "AI assistance",
      text: "AI coding assistants helped with research, code, explanations and checking. Every number comes from the cited data and code, not from a language model. The official interpretation of earlier AI-assisted ideation for this challenge is unresolved, and we do not claim eligibility.",
    },
  ],
  evidence: "NASA does not author, endorse or certify this project.",
};

export const glossary = [
  [
    "Terrain horizon",
    "The skyline made by real hills and ridges, not the smooth edge of a ball.",
  ],
  ["Elevation angle", "How high something is above the horizon, in degrees."],
  ["Azimuth", "The compass direction of something along the horizon."],
  ["DEM", "A digital elevation model: a grid of ground heights."],
  ["UTC", "A standard world time used so everyone reads the same clock."],
];
