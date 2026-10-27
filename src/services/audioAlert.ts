/**
 * Audio Alert Synthesizer using Web Audio API
 * Generates industrial warning beeps and fire siren alerts without external audio files.
 */

class SoundAlertController {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private isAlarmPlaying: boolean = false;
  private alarmInterval: any = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (!val) {
      this.stopAlarm();
    }
  }

  // Warning double-beep for elevated sensor readings
  public playWarningBeep() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.setValueAtTime(1100, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio might be blocked by autoplay policy before user gesture
    }
  }

  // Critical Fire Siren tone
  public playFireSiren() {
    if (!this.enabled || this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    try {
      this.initCtx();
      if (!this.ctx) return;

      const runSirenPulse = () => {
        if (!this.isAlarmPlaying || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.45);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.9);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 1.0);
      };

      runSirenPulse();
      this.alarmInterval = setInterval(runSirenPulse, 1200);
    } catch {
      this.isAlarmPlaying = false;
    }
  }

  public stopAlarm() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }
}

export const audioAlert = new SoundAlertController();
