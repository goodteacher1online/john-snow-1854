// Web Audio API를 활용한 순수 코드 합성 사운드 엔진 (에셋 다운로드 0초, 100% 무지연)
class SoundFXManager {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. 발걸음 소리 (가벼운 자갈길 탭)
  public playFootstep() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 2. 가구 문 노크 소리 (묵직한 두 번의 타격)
  public playDoorKnock() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const times = [0, 0.12];
    times.forEach(t => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const now = this.ctx!.currentTime + t;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    });
  }

  // 3. 단서 및 사망자 기록 시 맑은 종소리
  public playClueRecorded() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 아르페지오
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const now = this.ctx!.currentTime + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  // 4. 결정적 이상치(양조장 0명!) 발견 시 극적인 충격음 (Dramatic Shock)
  public playShockAnomaly() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // 저음 쿵 (Thud)
    const lowOsc = this.ctx.createOscillator();
    const lowGain = this.ctx.createGain();
    lowOsc.type = 'sawtooth';
    lowOsc.frequency.setValueAtTime(130, now);
    lowOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    lowGain.gain.setValueAtTime(0.4, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    lowOsc.connect(lowGain);
    lowGain.connect(this.ctx.destination);
    lowOsc.start(now);
    lowOsc.stop(now + 0.6);

    // 긴장감 고음 불협화음
    const highOsc = this.ctx.createOscillator();
    const highGain = this.ctx.createGain();
    highOsc.type = 'sine';
    highOsc.frequency.setValueAtTime(920, now + 0.05);
    highOsc.frequency.linearRampToValueAtTime(880, now + 0.7);

    highGain.gain.setValueAtTime(0.2, now + 0.05);
    highGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    highOsc.connect(highGain);
    highGain.connect(this.ctx.destination);
    highOsc.start(now + 0.05);
    highOsc.stop(now + 0.7);
  }

  // 5. 콜레라 종식 펌프 손잡이 제거 승리 팡파르
  public playVictoryFanfare() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const chords = [
      { freq: 440.0, time: 0, dur: 0.2 },      // A4
      { freq: 554.37, time: 0.15, dur: 0.2 },   // C#5
      { freq: 659.25, time: 0.3, dur: 0.2 },    // E5
      { freq: 880.0, time: 0.45, dur: 0.8 }     // A5 (길게)
    ];

    chords.forEach(({ freq, time, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const now = this.ctx!.currentTime + time;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + dur);
    });
  }
}

export const sound = new SoundFXManager();
