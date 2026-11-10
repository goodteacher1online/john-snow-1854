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

  // 5. 펌프 손잡이 분리 시 무쇠 덜컥 소리 (Mechanical Clank & Metal Release)
  public playPumpHandleDetach() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 금속 둔탁한 타격
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(240, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // 삐걱하는 금속 마찰음
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(600, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(150, now + 0.35);
    gain2.gain.setValueAtTime(0.25, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  }

  // 6. 콜레라 종식 펌프 손잡이 제거 승리 팡파르 (Glorious Brass Fanfare)
  public playVictoryFanfare() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const chords = [
      { freq: 440.0, time: 0, dur: 0.18 },      // A4
      { freq: 554.37, time: 0.15, dur: 0.18 },   // C#5
      { freq: 659.25, time: 0.3, dur: 0.2 },    // E5
      { freq: 880.0, time: 0.45, dur: 0.4 },    // A5
      { freq: 783.99, time: 0.75, dur: 0.2 },   // G5
      { freq: 880.0, time: 0.95, dur: 0.9 }     // A5 (대단원)
    ];

    chords.forEach(({ freq, time, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const now = this.ctx!.currentTime + time;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + dur);
    });
  }

  // 7. 수첩에 한 줄 적는 펜 소리 / 틀린 답의 낮은 울림
  public playPen() { this.blip('triangle', 820, 520, 0.07, 0.1); }
  public playWrong() { this.blip('sawtooth', 160, 90, 0.28, 0.16); }

  private blip(type: OscillatorType, from: number, to: number, dur: number, vol: number) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }
}

export const sound = new SoundFXManager();
