// Original procedural ambient composition. No samples, external tracks or requests.
// The caller starts scheduling only after the browser allows AudioContext to run.
export function createAmbientScore(context, initialVolume = 20) {
  const output = context.createGain();
  output.gain.value = 0;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.5;
  filter.connect(output);
  output.connect(context.destination);
  const chords = [
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [48, 55, 60, 64],
    [43, 50, 55, 59],
  ];
  // 80 bpm, eighth-note clock. A bass pulse, answering arpeggios and changing
  // voicings add movement without drums or any link to scientific quantities.
  const stepSeconds = 0.375;
  const motif = [0, 2, 1, 3, 2, 1, 3, 2, 0, 3, 2, 1, 3, 2, 1, 2];
  const hz = (note) => 440 * 2 ** ((note - 69) / 12);
  const pads = chords[0].map((note, i) => {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = i % 2 ? "sine" : "triangle";
    oscillator.frequency.value = hz(note);
    oscillator.detune.value = i % 2 ? 3 : -3;
    gain.gain.value = [0.085, 0.055, 0.04, 0.03][i];
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    return { oscillator, gain };
  });
  const notes = new Set();
  let timer = null,
    beat = 0,
    nextAt = 0,
    lastChord = -1,
    disposed = false,
    playing = false,
    volume = initialVolume;
  function setVolume(value) {
    const amount = Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : 0;
    volume = amount;
    if (playing)
      output.gain.setTargetAtTime(amount / 250, context.currentTime, 0.08);
  }
  setVolume(initialVolume);
  function tick() {
    if (disposed || !playing || context.state !== "running") return;
    const now = context.currentTime;
    // A throttled background tab must skip missed notes, not allocate minutes
    // of already-expired oscillators when its JavaScript timer resumes.
    if (nextAt < now - 0.2) {
      beat += Math.ceil((now - nextAt) / stepSeconds);
      nextAt = now + 0.08;
    }
    let budget = 2;
    while (nextAt < now + 0.2 && budget-- > 0) {
      const chordIndex = Math.floor(beat / 16) % chords.length;
      const step = beat % 16;
      if (chordIndex !== lastChord) {
        pads.forEach(({ oscillator }, i) => {
          oscillator.frequency.cancelScheduledValues(nextAt);
          oscillator.frequency.setValueAtTime(
            oscillator.frequency.value,
            nextAt,
          );
          oscillator.frequency.exponentialRampToValueAtTime(
            hz(chords[chordIndex][i]),
            nextAt + 1.2,
          );
        });
        lastChord = chordIndex;
      }
      // Space in the phrase, plus a strict live-voice ceiling. A background
      // scheduler stall never turns into a burst of catch-up notes.
      if (notes.size >= 6 || step === 7 || step === 15) {
        beat++;
        nextAt += stepSeconds;
        continue;
      }
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      const bass = step === 0 || step === 8;
      const answer = Math.floor(beat / 64) % 2;
      oscillator.type = bass
        ? "triangle"
        : step % 4 === 2
          ? "triangle"
          : "sine";
      oscillator.frequency.value = hz(
        bass
          ? chords[chordIndex][0] - 12
          : chords[chordIndex][motif[step]] +
              12 +
              (answer && step % 4 === 0 ? 12 : 0),
      );
      const duration = bass ? 0.66 : step % 4 === 0 ? 1.05 : 0.52;
      gain.gain.setValueAtTime(0, nextAt);
      gain.gain.linearRampToValueAtTime(bass ? 0.055 : 0.038, nextAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, nextAt + duration);
      // Gentle breathing in the harmonic bed follows the phrase, not the clock
      // or illumination values of the simulator.
      pads.forEach(({ gain: padGain }, j) => {
        const base = [0.085, 0.055, 0.04, 0.03][j];
        padGain.gain.setTargetAtTime(base * (bass ? 0.78 : 1), nextAt, 0.12);
      });
      oscillator.connect(gain);
      gain.connect(filter);
      const voice = { oscillator, gain };
      notes.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        notes.delete(voice);
      };
      oscillator.start(nextAt);
      oscillator.stop(nextAt + duration + 0.04);
      beat++;
      nextAt += stepSeconds;
    }
  }
  function clearNotes() {
    for (const { oscillator, gain } of notes) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    notes.clear();
  }
  return {
    setVolume,
    async play() {
      if (disposed) return;
      await context.resume();
      if (disposed) return;
      playing = true;
      output.gain.setTargetAtTime(volume / 250, context.currentTime, 0.08);
      nextAt = context.currentTime + 0.08;
      if (timer === null) {
        tick();
        timer = setInterval(tick, 100);
      }
    },
    async pause() {
      playing = false;
      clearInterval(timer);
      timer = null;
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setTargetAtTime(0, context.currentTime, 0.025);
      await new Promise((resolve) => setTimeout(resolve, 140));
      if (disposed) return;
      clearNotes();
      await context.suspend();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      timer = null;
      for (const { oscillator, gain } of pads) {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      }
      clearNotes();
      filter.disconnect();
      output.disconnect();
      if (context.state !== "closed") context.close().catch(() => {});
    },
  };
}
