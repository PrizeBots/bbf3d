/**
 * SoundManager - Handles game audio using Web Audio API
 *
 * Creates procedural sounds for attacks, harvesting, and other game events.
 */
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.enabled = true;
        this.volume = 0.3;

        this.init();
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    /**
     * Resume audio context (needed after user interaction)
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }

    /**
     * Play a combat attack sound (punch/hit)
     */
    playAttackSound() {
        if (!this.enabled || !this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        // Create noise burst for impact
        const bufferSize = this.audioContext.sampleRate * 0.08;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        // Filter for punch sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialDecayTo = 0.01;
        gain.gain.setTargetAtTime(0.01, now, 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.1);
    }

    /**
     * Play a sword slash sound
     */
    playSwordSound() {
        if (!this.enabled || !this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        // High-frequency swoosh
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

        // Noise for texture
        const bufferSize = this.audioContext.sampleRate * 0.12;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.setTargetAtTime(0.01, now, 0.05);

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.setTargetAtTime(0.01, now, 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
        noise.start(now);
        noise.stop(now + 0.12);
    }

    /**
     * Play a harvest/chop sound (for trees)
     */
    playHarvestSound() {
        if (!this.enabled || !this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        // Thunk sound
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

        // Add some noise
        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.setTargetAtTime(0.01, now, 0.04);

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.setTargetAtTime(0.01, now, 0.03);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.12);
        noise.start(now);
        noise.stop(now + 0.1);
    }

    /**
     * Play a mining/stone hit sound
     */
    playMineSound() {
        if (!this.enabled || !this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        // Sharp ping/clink
        const osc = this.audioContext.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.06);

        // Noise burst
        const bufferSize = this.audioContext.sampleRate * 0.06;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1500;

        const gain1 = this.audioContext.createGain();
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.setTargetAtTime(0.01, now, 0.03);

        const gain2 = this.audioContext.createGain();
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.setTargetAtTime(0.01, now, 0.025);

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.setTargetAtTime(0.01, now, 0.02);

        osc.connect(gain1);
        gain1.connect(this.masterGain);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
        osc2.start(now);
        osc2.stop(now + 0.08);
        noise.start(now);
        noise.stop(now + 0.06);
    }

    /**
     * Play eating/gulp sound
     */
    playEatSound() {
        if (!this.enabled || !this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setTargetAtTime(0.01, now, 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// Global sound manager instance
export const soundManager = new SoundManager();
