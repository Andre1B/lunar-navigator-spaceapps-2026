// Original report layout. jsPDF (MIT) is loaded only when the visitor exports.
import { jsPDF } from "jspdf";
import { comparisonReport, comparisonRows } from "./comparisonReport.mjs";
import { arrivalSeries } from "./arrivalSeries.mjs";
import { percent, timeAt } from "./analysis.mjs";

const C = {
  background: [7, 12, 24],
  panel: [15, 30, 48],
  ink: [245, 247, 250],
  muted: [184, 202, 220],
  line: [54, 76, 101],
  gold: [246, 195, 111],
  cyan: [114, 199, 235],
  red: [255, 175, 161],
};
const clean = (value) =>
  String(value ?? "Not calculated")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2265/g, ">=")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2192/g, " -> ")
    .replace(/\u2194/g, " <-> ")
    .replace(/\u00b0/g, " deg")
    .replace(/[\u200b-\u200f\ufeff]/g, "");
const shortName = (point) => point?.name?.split(" (")[0] ?? "Unknown point";
const duration = (interval) =>
  interval && Number.isFinite(interval.hours)
    ? `${interval.censored ? "At least " : ""}${interval.hours.toFixed(1)} h`
    : "Not calculated";
const utc = (value) =>
  value ? value.slice(0, 16).replace("T", " ") + " UTC" : "Not calculated";
const base64 = (bytes) => {
  const array = new Uint8Array(bytes);
  let text = "";
  for (let i = 0; i < array.length; i += 16384)
    text += String.fromCharCode(...array.subarray(i, i + 16384));
  return btoa(text);
};

export async function createComparisonPdf(
  dataset,
  settings,
  limitH,
  options = {},
) {
  const report = comparisonReport(dataset, settings, limitH);
  if (!report) throw new Error("The scientific dataset has not loaded yet.");
  const rows = comparisonRows(dataset, settings);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  let font = "helvetica";
  try {
    const fonts =
      options.fontBytes ??
      (await Promise.all(
        ["regular", "bold"].map(async (style) => {
          const response = await fetch(
            `/assets/fonts/overpass-5.3.0-report-${style}.ttf`,
          );
          if (!response.ok) throw new Error("Report font unavailable");
          return response.arrayBuffer();
        }),
      ));
    for (const [i, style] of ["normal", "bold"].entries()) {
      const file = `Overpass-${style}.ttf`;
      doc.addFileToVFS(file, base64(fonts[i]));
      doc.addFont(file, "Overpass", style);
    }
    font = "Overpass";
  } catch {
    // A missing decorative font must not hide or alter the scientific report.
  }
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight();
  const M = 36,
    width = W - M * 2,
    bottom = H - 45;
  let y = 90,
    page = 0,
    currentTitle = "Comparison";
  const set = (size = 11, color = C.ink, bold = false) => {
    doc.setFont(font, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const write = (
    text,
    x,
    top,
    size = 11,
    color = C.ink,
    bold = false,
    maxWidth = width,
  ) => {
    set(size, color, bold);
    const lines = doc.splitTextToSize(clean(text), maxWidth);
    doc.text(lines, x, top, { lineHeightFactor: 1.35 });
    return lines.length * size * 1.35;
  };
  const line = (x1, y1, x2, y2, color = C.line, weight = 0.6) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(x1, y1, x2, y2);
  };
  const newPage = (title, eyebrow = "FAITHFUL COMPARISON") => {
    if (!title.endsWith(" - continued")) currentTitle = title;
    if (page++) doc.addPage();
    doc.setFillColor(...C.background);
    doc.rect(0, 0, W, H, "F");
    set(10, C.ink, true);
    doc.text("LUNAR NAVIGATOR", M, 26);
    set(8, C.muted);
    doc.text("SITE + DATE + HEIGHT  /  SUN + EARTH + TERRAIN", W - M, 26, {
      align: "right",
    });
    line(M, 38, W - M, 38);
    write(eyebrow, M, 58, 8, C.cyan, true);
    set(23, C.ink, true);
    const titleSize = Math.min(
      23,
      (23 * width) / Math.max(width, doc.getTextWidth(clean(title))),
    );
    write(title, M, 84, titleSize, C.ink, true);
    y = 108;
  };
  const ensure = (height, title) => {
    if (y + height > bottom) newPage(title ?? `${currentTitle} - continued`);
  };
  const paragraph = (
    text,
    { size = 10, color = C.muted, bold = false, url } = {},
  ) => {
    set(size, color, bold);
    const lines = doc.splitTextToSize(clean(text), width);
    for (const content of lines) {
      ensure(size * 1.4 + 3);
      write(content, M, y, size, color, bold);
      if (url && /^https:\/\//.test(url))
        doc.link(
          M,
          y - size,
          Math.min(width, doc.getTextWidth(content)),
          size * 1.35,
          { url },
        );
      y += size * 1.4;
    }
    y += 7;
  };
  const heading = (title) => {
    ensure(44);
    y += 9;
    write(title, M, y, 15, C.ink, true);
    y += 25;
  };
  const table = (headers, body, widths, { size = 9.5, colors = {} } = {}) => {
    const pad = 7,
      lh = size * 1.32;
    const renderRow = (cells, header = false) => {
      set(size, C.ink, header);
      const lines = cells.map((v, i) =>
        doc.splitTextToSize(clean(v), widths[i] - pad * 2),
      );
      const height = Math.max(...lines.map((a) => a.length)) * lh + pad * 2;
      if (y + height > bottom) {
        newPage(`${currentTitle} - continued`);
        if (!header) renderRow(headers, true);
      }
      let x = M;
      if (header) {
        doc.setFillColor(...C.panel);
        doc.rect(M, y - size, width, height, "F");
      }
      cells.forEach((_, i) => {
        set(size, header ? C.ink : (colors[i] ?? C.muted), header);
        doc.text(lines[i], x + pad, y + pad, { lineHeightFactor: 1.32 });
        x += widths[i];
      });
      line(M, y - size + height, W - M, y - size + height);
      y += height;
    };
    renderRow(headers, true);
    body.forEach((row) => renderRow(row));
    y += 14;
  };

  newPage("What does an arrival delay change?");
  paragraph(
    "The same stay, compared three ways: original arrival, the same place later, and another place on that delayed date.",
  );
  const original = rows[0]?.summary?.dark,
    delayed = rows[1]?.summary?.dark;
  let answer = "Choose an arrival and stay that fit inside the computed dates.";
  if (original && delayed) {
    if (original.censored || delayed.censored)
      answer =
        "An interval reaches a window edge. 'At least' is a lower bound; its full length can be longer.";
    else {
      const difference = delayed.hours - original.hours;
      answer =
        Math.abs(difference) < 0.05
          ? "The longest stretch without sunlight is unchanged in these two windows."
          : `A ${settings.delay}-day delay makes the longest stretch without sunlight ${Math.abs(difference).toFixed(1)} hours ${difference > 0 ? "longer" : "shorter"} at the same place.`;
    }
  }
  paragraph(answer, { size: 13, color: C.gold, bold: true });
  paragraph(
    `Arrival ${settings.date || "not set"} UTC  |  Stay ${settings.days} days  |  Delay +${settings.delay} days  |  Observer ${settings.height} m above terrain`,
    { size: 11 },
  );
  const cardY = y + 5,
    gap = 14,
    cardWidth = (width - gap * 2) / 3,
    cardHeight = 253;
  rows.forEach((row, i) => {
    const x = M + i * (cardWidth + gap),
      point = dataset.manifest.sites.find((s) => s.id === row.id);
    doc.setFillColor(...C.panel);
    doc.rect(x, cardY, cardWidth, cardHeight, "F");
    write(row.label, x + 14, cardY + 24, 13, C.ink, true, cardWidth - 28);
    write(
      shortName(point),
      x + 14,
      cardY + 45,
      10,
      C.muted,
      false,
      cardWidth - 28,
    );
    write(
      row.arrival?.utc?.slice(0, 10) ?? "Not calculated",
      x + 14,
      cardY + 62,
      10,
      C.muted,
    );
    write("Longest stretch without sunlight", x + 14, cardY + 88, 10, C.muted);
    write(
      duration(row.summary?.dark),
      x + 14,
      cardY + 115,
      21,
      C.gold,
      true,
      cardWidth - 28,
    );
    [
      ["Sun visible - % of stay", row.summary?.sunlitFraction, C.gold],
      ["Earth visible - % of stay", row.summary?.earthFraction, C.cyan],
    ].forEach(([label, fraction, color], k) => {
      const top = cardY + 145 + k * 37;
      write(label, x + 14, top, 9.5, C.muted, false, cardWidth - 98);
      set(Number.isFinite(fraction) ? 13 : 9.5, color, true);
      doc.text(clean(percent(fraction)), x + cardWidth - 14, top, {
        align: "right",
      });
      doc.setFillColor(...C.line);
      doc.rect(x + 14, top + 8, cardWidth - 28, 4, "F");
      if (Number.isFinite(fraction)) {
        doc.setFillColor(...color);
        doc.rect(x + 14, top + 8, (cardWidth - 28) * fraction, 4, "F");
      }
    });
    write(
      "At arrival - unblocked part of each disc",
      x + 14,
      cardY + 220,
      9,
      C.muted,
    );
    write(
      `Sun ${percent(row.arrival?.sunVisibleDiscFraction)}   Earth ${percent(row.arrival?.earthVisibleDiscFraction)}`,
      x + 14,
      cardY + 239,
      11,
      C.ink,
      true,
      cardWidth - 28,
    );
  });
  y = cardY + cardHeight + 22;
  paragraph(
    "Stay percentages count time when any part is visible. Arrival percentages measure the part of the disc visible after terrain and geometric Earth occultation at one instant. Neither is an electrical-power percentage or a guaranteed radio connection.",
  );

  newPage("Measurements, assumptions and your example limit");
  paragraph(
    `Faithful calculations at ${settings.height} m. User darkness limit: ${limitH} hours - an example, not a NASA requirement or battery model.`,
  );
  table(
    [
      "Scenario",
      "Mean Sun disc",
      "Sun visible (% time)",
      "Longest darkness",
      "Earth visible (% time)",
      "Longest Earth gap",
    ],
    rows.map((row) => [
      row.label,
      percent(row.summary?.meanSun),
      percent(row.summary?.sunlitFraction),
      duration(row.summary?.dark),
      percent(row.summary?.earthFraction),
      duration(row.summary?.noEarth),
    ]),
    [132, 105, 133, 134, 133, width - 637],
    { colors: { 1: C.gold, 2: C.gold, 4: C.cyan } },
  );
  table(
    ["Scenario", "UTC operating window", "Your example darkness limit"],
    report.scenarios.map((scenario) => [
      scenario.label,
      `${utc(scenario.startUtc)} to ${utc(scenario.endUtc)}`,
      scenario.exampleDarknessAssessment.message,
    ]),
    [132, 300, width - 432],
    { colors: { 2: C.gold } },
  );
  heading("Read these numbers correctly");
  paragraph(
    Object.entries(report.method)
      .map(([name, meaning]) => `${name}: ${meaning}`)
      .join(" "),
  );

  newPage("The sky at each arrival");
  paragraph(
    "Each chart is one arrival instant, not an average. Gold: Sun. Cyan: Earth. Grey line: computed terrain horizon. Discs are enlarged markers, not angular-size drawings.",
  );
  const chartTop = y + 10;
  rows.forEach((row, k) => {
    const x = M + k * (cardWidth + gap),
      data = dataset.sites[row.id],
      idx = row.bounds?.start;
    write(row.label, x, chartTop, 12, C.ink, true, cardWidth);
    if (idx === undefined || !data) {
      write("Not calculated", x, chartTop + 45, 12, C.muted);
      return;
    }
    write(utc(row.arrival.utc), x, chartTop + 18, 9, C.muted, false, cardWidth);
    const profile = data.horizon.elevationDeg[String(settings.height)];
    const low =
      Math.min(-3, ...profile, data.sun.elDeg[idx], data.earth.elDeg[idx]) - 1;
    const high =
      Math.max(6, ...profile, data.sun.elDeg[idx], data.earth.elDeg[idx]) + 1;
    const px = (az) => x + 12 + (az / 360) * (cardWidth - 24);
    const py = (el) => chartTop + 148 - ((el - low) / (high - low)) * 100;
    line(px(0), py(0), px(360), py(0), C.line, 0.8);
    for (let n = 1; n <= profile.length; n++)
      line(
        px(((n - 1) / profile.length) * 360),
        py(profile[n - 1]),
        px((n / profile.length) * 360),
        py(profile[n % profile.length]),
        C.muted,
        0.65,
      );
    [0, 90, 180, 270, 360].forEach((az) =>
      write(`${az}`, px(az) - 5, chartTop + 165, 8, C.muted),
    );
    [
      ["Sun", data.sun, C.gold],
      ["Earth", data.earth, C.cyan],
    ].forEach(([name, body, color], n) => {
      const xx = px(body.azDeg[idx]),
        yy = py(body.elDeg[idx]);
      doc.setFillColor(...color);
      doc.circle(xx, yy, 3, "F");
      write(
        `${name} disc ${percent(n ? row.arrival.earthVisibleDiscFraction : row.arrival.sunVisibleDiscFraction)}`,
        x + 2,
        chartTop + 185 + n * 17,
        10,
        color,
        true,
        cardWidth - 4,
      );
    });
  });
  y = chartTop + 230;
  paragraph(
    `Azimuth: degrees clockwise from north. Position arrays refer to the documented 1 m geometry; disc fractions and horizon use the selected ${settings.height} m height.`,
    { size: 9 },
  );
  heading("Visibility across the stay");
  rows.forEach((row) => {
    ensure(61);
    write(
      `${row.label} - ${shortName(dataset.manifest.sites.find((s) => s.id === row.id))}`,
      M,
      y,
      10,
      C.ink,
      true,
    );
    if (!row.bounds) {
      write("Not calculated", M + 300, y, 10, C.muted);
      y += 32;
      return;
    }
    const data = dataset.sites[row.id],
      count = row.bounds.end - row.bounds.start;
    [
      ["Sun", data.sun, C.gold],
      ["Earth", data.earth, C.cyan],
    ].forEach(([label, body, color], k) => {
      write(label, M, y + 16 + k * 13, 9, color);
      const values = body.visibleFraction[String(settings.height)].slice(
        row.bounds.start,
        row.bounds.end,
      );
      values.forEach((fraction, n) => {
        doc.setFillColor(
          ...C.line.map((v, j) =>
            Math.round(
              v + (color[j] - v) * Math.max(0, Math.min(1, fraction ?? 0)),
            ),
          ),
        );
        doc.rect(
          M + 42 + (n / count) * (width - 42),
          y + 7 + k * 13,
          (width - 42) / count + 0.1,
          9,
          "F",
        );
      });
    });
    y += 48;
  });
  paragraph(
    "Timeline brightness is the visible disc fraction at hourly samples. Sub-hour events can be absent from this drawing; duration metrics use the refined event search.",
    { size: 9 },
  );
  heading("Geometric eclipses intersecting these stays");
  table(
    [
      "Scenario",
      "Full eclipse contacts (UTC)",
      "Minimum disc not blocked by Earth",
    ],
    report.scenarios.flatMap((scenario) =>
      scenario.status !== "calculated"
        ? [[scenario.label, "Not calculated", "Not calculated"]]
        : scenario.eclipses.length
          ? scenario.eclipses.map((e) => [
              scenario.label,
              `${utc(e.startUtc)} to ${utc(e.endUtc)}`,
              percent(e.minimumUnobscuredFraction),
            ])
          : [
              [
                scenario.label,
                "No computed eclipse intersects this stay",
                "Not applicable",
              ],
            ],
    ),
    [132, 370, width - 502],
  );
  paragraph(
    "Contacts and minima describe each full computed eclipse, which can extend beyond your stay. Minima use a 5-minute grid and ignore terrain; stay metrics use the joint terrain/Earth calculation only inside the chosen window. Uniform Sun, opaque spherical Earth, no atmosphere or irradiance model.",
    { size: 9 },
  );

  newPage("Every computed arrival date - the same question");
  const series = arrivalSeries(
    dataset.sites[settings.siteId],
    dataset.manifest.period,
    settings.height,
    settings.days,
  );
  paragraph(
    `${shortName(dataset.manifest.sites.find((s) => s.id === settings.siteId))} | ${settings.height} m | ${settings.days}-day stay starting at 00:00 UTC on each date. Complete date table; no ranking or recommendation.`,
  );
  if (series.length)
    table(
      [
        "Arrival UTC",
        "Mean Sun disc",
        "Sun visible (% time)",
        "Longest darkness",
        "Earth visible (% time)",
        "Longest Earth gap",
      ],
      series.map((s) => [
        s.date,
        percent(s.summary?.meanSun),
        percent(s.summary?.sunlitFraction),
        duration(s.summary?.dark),
        percent(s.summary?.earthFraction),
        duration(s.summary?.noEarth),
      ]),
      [117, 113, 133, 134, 133, width - 630],
    );
  else paragraph("Not calculated for this stay length.");

  newPage("Sources, validation and reproducibility");
  paragraph(
    `Generated ${report.generatedAtUtc}. Data generated ${report.dataset.manifestGeneratedAtUtc}. Coverage ${utc(report.coverage.startUtc)} to ${utc(report.coverage.endUtc)}.`,
  );
  if (report.coveragePolicy)
    paragraph(`Coverage policy: ${JSON.stringify(report.coveragePolicy)}`, {
      size: 9,
    });
  paragraph(
    `Source revision: ${report.build?.revision ?? "source archive / revision unavailable"}; dirty: ${report.build?.dirty ?? "unknown"}; dataset schema ${report.dataset.schemaVersion}.`,
    { size: 9 },
  );
  paragraph("Source code and licences: " + report.sourceCode, {
    url: report.sourceCode,
  });
  heading("The points used in this comparison");
  [...new Set(rows.map((r) => r.id))].forEach((id) => {
    const point = dataset.manifest.sites.find((s) => s.id === id);
    if (!point) return;
    paragraph(
      `${point.name}: latitude ${point.latitudeDeg} deg; east longitude ${point.longitudeEastDeg} deg; terrain elevation ${point.terrainElevationM} m above the 1737.4 km sphere. ${point.coordinateSource} Not a selected landing site.`,
    );
  });
  heading("Executed validation");
  for (const test of dataset.validation?.tests ?? []) {
    paragraph(`${test.id} - ${test.title} - ${test.status}`, {
      bold: true,
      color: C.ink,
    });
    paragraph(
      `Target: ${typeof test.target === "string" ? test.target : JSON.stringify(test.target)}. Result: ${JSON.stringify(test.result)}. ${Array.isArray(test.notes) ? test.notes.join(" ") : (test.notes ?? "")}`,
      { size: 9 },
    );
  }
  heading("Conventions and assumptions");
  Object.entries(report.conventions).forEach(([key, value]) =>
    paragraph(
      `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      { size: 9 },
    ),
  );
  (dataset.manifest.assumptions ?? []).forEach((value) =>
    paragraph(value, { size: 9 }),
  );
  heading("Limitations");
  report.limitations.forEach((value) => paragraph(value));
  heading("NASA / data sources and input hashes");
  for (const item of [
    ...(report.provenance.kernels ?? []),
    ...(report.provenance.dems ?? []),
  ]) {
    paragraph(`${item.file}${item.role ? ` (${item.role})` : ""}`, {
      bold: true,
      color: C.ink,
    });
    if (item.url) paragraph(item.url, { url: item.url, size: 9 });
    if (item.sha256) paragraph(`SHA-256 ${item.sha256}`, { size: 8.5 });
  }
  for (const reference of report.provenance.references ?? []) {
    const url =
      reference.url ??
      (reference.doi ? `https://doi.org/${reference.doi}` : null);
    paragraph(`${reference.label}${url ? ` - ${url}` : ""}`, { url, size: 9 });
  }
  heading("Exact derived dataset used");
  for (const item of report.dataset.integrity?.files ?? [])
    paragraph(`${item.file} (${item.bytes} bytes) - SHA-256 ${item.sha256}`, {
      size: 8.5,
    });
  paragraph(
    "An advanced JSON download of the same settings and results is also available on the comparison page. No settings or data were uploaded to create this PDF.",
  );
  paragraph(
    "Original app code: Apache-2.0. PDF generation: jsPDF, MIT, https://github.com/parallax/jsPDF. Report typeface: Overpass, SIL OFL1.1, https://github.com/RedHatOfficial/Overpass. Scientific data and third-party software retain their own terms.",
    { size: 9 },
  );
  paragraph(
    "AI assistance: implementation, explanations and research were developed with Claude/Codex assistance under human direction. The numerical results come from code operating on documented NASA/NAIF data, not generated measurements. The prototype does not claim NASA endorsement, operational safety or resolved competition eligibility.",
    { size: 9 },
  );
  paragraph(
    "Full sources, acknowledgements and AI disclosure: https://lunar-navigator-2026.pages.dev/#/credits",
    { url: "https://lunar-navigator-2026.pages.dev/#/credits", size: 9 },
  );
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    line(M, H - 32, W - M, H - 32);
    set(8, C.muted);
    doc.text("EDUCATIONAL COMPARISON - NOT OPERATIONAL GUIDANCE", M, H - 17);
    doc.text(`${n} / ${total}`, W - M, H - 17, { align: "right" });
  }
  doc.setProperties({
    title: "Lunar Navigator - arrival comparison",
    subject: "Faithful Sun/Earth visibility comparison",
    author: "Team An0r4k",
    creator: "Lunar Navigator / jsPDF",
  });
  return doc;
}

export async function downloadComparisonPdf(dataset, settings, limitH) {
  const doc = await createComparisonPdf(dataset, settings, limitH);
  const label = /^\d{4}-\d{2}-\d{2}$/.test(settings.date ?? "") ? settings.date : "unavailable";
  doc.save(`lunar-navigator-comparison-${label}.pdf`);
}
