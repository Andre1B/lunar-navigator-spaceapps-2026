// Original procedural ambient composition. No samples, external tracks or requests.
// The caller creates/resumes AudioContext only after a user gesture.
export function createAmbientScore(context, initialVolume = 20) {
  const output = context.createGain();
  output.gain.value = 0;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  filter.Q.value = 0.5;
  filter.connect(output);
  output.connect(context.destination);
  const chords = [
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [48, 55, 60, 64],
    [43, 50, 55, 59],
  ];
  const motif = [0, 2, 1, 3, 2, 1, 0, 2];
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
    if (disposed || context.state !== "running") return;
    const now = context.currentTime;
    // A throttled background tab must skip missed notes, not allocate minutes
    // of already-expired oscillators when its JavaScript timer resumes.
    if (nextAt < now - 0.2) {
      beat += Math.ceil((now - nextAt) / 1.5);
      nextAt = now + 0.08;
    }
    let budget = 2;
    while (nextAt < now + 0.2 && budget-- > 0) {
      const chordIndex = Math.floor(beat / 8) % chords.length;
      if (chordIndex !== lastChord) {
        pads.forEach(({ oscillator }, i) => {
          oscillator.frequency.cancelScheduledValues(nextAt);
          oscillator.frequency.setValueAtTime(
            oscillator.frequency.value,
            nextAt,
          );
          oscillator.frequency.exponentialRampToValueAtTime(
            hz(chords[chordIndex][i]),
            nextAt + 2,
          );
        });
        lastChord = chordIndex;
      }
      if (notes.size >= 6) {
        beat++;
        nextAt += 1.5;
        continue;
      }
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = hz(
        chords[chordIndex][motif[beat % motif.length]] + 12,
      );
      gain.gain.setValueAtTime(0, nextAt);
      gain.gain.linearRampToValueAtTime(0.025, nextAt + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, nextAt + 2.6);
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
      oscillator.stop(nextAt + 2.7);
      beat++;
      nextAt += 1.5;
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
