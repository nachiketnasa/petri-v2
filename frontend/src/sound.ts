// Web Audio tone synthesis for the Settings sound-effects toggle. No audio
// files are shipped or licensed; each tone is a short synthesized beep.

const SOUND_KEY = 'petri:soundEffectsEnabled'

export type SoundMoment = 'wizard-open' | 'wizard-submit' | 'check-in-log'

const FREQUENCIES: Record<SoundMoment, number> = {
  'wizard-open': 440,
  'wizard-submit': 660,
  'check-in-log': 880,
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, String(enabled))
  } catch {
    // Storage can be unavailable (private browsing); the toggle just won't persist.
  }
}

// Plays a short synthesized tone for the given moment, only when sound
// effects are turned on. Uses the Web Audio API directly, no audio files.
export function playTone(moment: SoundMoment) {
  if (!isSoundEnabled()) return
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = FREQUENCIES[moment]
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.2)
    oscillator.onended = () => ctx.close()
  } catch {
    // Web Audio can be unavailable or blocked; sound is best effort only.
  }
}
