import { DOM, Events, Storage } from './utils.js';

/**
 * Audio Context manager for sound generation and playback.
 */
class AlertSystem {
  /**
   * Create an AlertSystem instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.isUnlocked = false;
    this.audioContext = null;
    this.alertSounds = new Map();
    this.volumeLevels = [0, 0.2, 0.5, 1.0]; // Mute, Low, Mid, Full
    this.volumeIndex = 2;
    this.masterVolume = this.volumeLevels[this.volumeIndex];

    this.$audioBtn = DOM.getId('audio-btn');
    this.$audioLine = DOM.getId('audio-disabled-line');
    this.$volumeBars = [DOM.getId('volume-bar-1'), DOM.getId('volume-bar-2'), DOM.getId('volume-bar-3')];

    this._initialize();
  }

  /**
   * Initialize the audio system and configure default settings.
   */
  _initialize() {
    this._listeners();
    this.generate();
    this.load();
  }

  /**
   * Set up event listeners for audio unlock and volume control.
   */
  _listeners() {
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach((type) => {
      document.addEventListener(type, this.unlock.bind(this), { once: true });
    });

    Events.on(this.$audioBtn, 'click', () => {
      if (!this.isUnlocked) {
        this.unlock();
      } else {
        this.cycle();
      }
    });
    Events.on(document, 'audioUnlocked', this.render.bind(this));
    Events.on(document, 'appRestarted', this.render.bind(this));
  }

  /**
   * Create and store predefined alert sound configurations.
   */
  generate() {
    this.alertSounds.set('Default', {
      name: 'Default Bell',
      frequencies: [800, 1000, 800],
      durations: [0.1, 0.1, 0.1],
      volumes: [0.3, 0.4, 0.3],
    });

    this.alertSounds.set('Gentle', {
      name: 'Gentle Chime',
      frequencies: [523, 659, 784],
      durations: [0.3, 0.3, 0.4],
      volumes: [0.2, 0.25, 0.2],
    });

    this.alertSounds.set('Bell', {
      name: 'Church Bell',
      frequencies: [440, 880, 440],
      durations: [0.5, 0.3, 0.5],
      volumes: [0.4, 0.3, 0.4],
    });

    this.alertSounds.set('Notification', {
      name: 'Notification',
      frequencies: [1000, 1200],
      durations: [0.1, 0.2],
      volumes: [0.3, 0.3],
    });

    this.alertSounds.set('Urgent', {
      name: 'Urgent Alert',
      frequencies: [1400, 1000, 1400, 1000],
      durations: [0.1, 0.1, 0.1, 0.1],
      volumes: [0.4, 0.3, 0.4, 0.3],
    });

    this.alertSounds.set('Peaceful', {
      name: 'Peaceful Tone',
      frequencies: [261, 329, 392],
      durations: [0.4, 0.4, 0.6],
      volumes: [0.2, 0.2, 0.2],
    });

    this.alertSounds.set('Digital', {
      name: 'Digital Beep',
      frequencies: [1200],
      durations: [0.15],
      volumes: [0.35],
    });

    this.alertSounds.set('Classic', {
      name: 'Classic Alarm',
      frequencies: [800, 1000, 800, 1000],
      durations: [0.2, 0.2, 0.2, 0.2],
      volumes: [0.3, 0.3, 0.3, 0.3],
    });

    this.alertSounds.set('None', {
      name: 'None (Silent)',
      frequencies: [],
      durations: [],
      volumes: [],
    });
  }

  /**
   * Initialize and activate the audio context for sound playback.
   */
  unlock() {
    if (this.isUnlocked) return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!this.audioContext) {
      console.warn('Failed to create audio context');
      return;
    }

    if (this.audioContext.state === 'running') {
      this.isUnlocked = true;
    } else {
      try {
        this.audioContext.resume();
        this.isUnlocked = true;
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return;
      }
    }

    console.log('Audio context unlocked');
    Events.dispatch(document, 'audioUnlocked', {
      isUnlocked: this.isUnlocked,
    });
  }

  /**
   * Load the volume setting from client configuration.
   */
  load() {
    const savedVolumeIndex = Storage.getClientSetting('audioVolumeIndex', 2);
    this.volumeIndex = Math.max(0, Math.min(3, savedVolumeIndex));
    this.masterVolume = this.volumeLevels[this.volumeIndex];
    this.render();
  }

  /**
   * Save the current volume setting to client configuration.
   */
  save() {
    Storage.saveClientSetting('audioVolumeIndex', this.volumeIndex);
  }

  /**
   * Cycle through available volume levels and update the display.
   */
  cycle() {
    this.volumeIndex = (this.volumeIndex + 1) % this.volumeLevels.length;
    this.masterVolume = this.volumeLevels[this.volumeIndex];
    this.render();
    this.save();
    this.play('Digital');
  }

  /**
   * Update the volume bar and audio button display based on current volume and unlock state.
   */
  render() {
    if (!this.isReady()) {
      this.$audioBtn.title = `Click to enable alerts`;
      this.$audioLine.style.display = 'block';
    } else {
      this.$audioBtn.title = `Click to change alert volume`;
      this.$audioLine.style.display = 'none';
    }

    this.$volumeBars.forEach(($bar, index) => {
      if (this.volumeIndex === 0) {
        $bar.style.display = 'none';
      } else if (index < this.volumeIndex) {
        $bar.style.display = 'block';
      } else {
        $bar.style.display = 'none';
      }
    });
  }

  /**
   * Get a list of available alert sound options.
   * @returns {Array<{value: string, name: string}>} Array of alert sound options.
   */
  list() {
    return Array.from(this.alertSounds.entries()).map(([key, sound]) => ({
      value: key,
      name: sound.name,
    }));
  }

  /**
   * Play an alert sound of the specified type.
   * @param {string} [alertType='Default'] - Type of alert to play.
   */
  async play(alertType = 'Default') {
    if (!this.isReady() || alertType === 'None' || !alertType) return;
    try {
      const sound = this.alertSounds.get(alertType);
      await this.playSound(sound);
    } catch (error) {
      console.error('Error playing alert:', error);
    }
  }

  /**
   * Play a sequence of tones for a given sound configuration.
   * @param {Object} sound - Sound configuration object.
   * @param {number[]} sound.frequencies - Array of frequencies in Hz.
   * @param {number[]} sound.durations - Array of durations in seconds.
   * @param {number[]} sound.volumes - Array of volumes (0-1).
   * @returns {Promise<void>} Promise that resolves when the sequence finishes.
   */
  playSound(sound) {
    return new Promise((resolve) => {
      const { frequencies, durations, volumes } = sound;
      let currentTime = this.audioContext.currentTime;

      frequencies.forEach((frequency, index) => {
        const duration = durations[index] || durations[0];
        const volume = (volumes[index] || volumes[0]) * this.masterVolume;

        this.playTone(frequency, duration, volume, currentTime);
        currentTime += duration + 0.05;
      });

      setTimeout(() => resolve(), currentTime * 1000 - this.audioContext.currentTime * 1000 + 100);
    });
  }

  /**
   * Play a single tone.
   * @param {number} frequency - Frequency in Hz.
   * @param {number} duration - Duration in seconds.
   * @param {number} volume - Volume (0-1).
   * @param {number} startTime - Start time in audio context time.
   */
  playTone(frequency, duration, volume, startTime) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.type = 'sine';

    const attackTime = 0.01;
    const releaseTime = 0.1;
    const sustainTime = duration - attackTime - releaseTime;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + attackTime);
    gainNode.gain.setValueAtTime(volume, startTime + attackTime + sustainTime);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  /**
   * Check if the audio context is available and unlocked.
   * @returns {boolean} True if audio is ready.
   */
  isReady() {
    return this.audioContext && this.isUnlocked;
  }

  /**
   * Dispose of audio resources and clear alert sounds.
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isUnlocked = false;
    this.alertSounds.clear();
  }
}

export default AlertSystem;
