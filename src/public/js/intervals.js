import Utils, { DOM, Events } from './utils.js';
import {
  DEFAULT_DURATION,
  MAX_NAME_LENGTH,
  MAX_STRING_LENGTH,
  MAX_DURATION,
  MIN_DURATION,
} from './shared/constants.js';

/**
 * Intervals manager class.
 */
class IntervalsManager {
  /**
   * Create a new IntervalsManager instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.isUpdating = false;
    this.collapsed = new Set(); // Track expanded intervals

    this.$intervalsBtn = DOM.getId('interval-status');
    this.$intervalsList = DOM.getId('intervals-list');
    this.$addBtn = DOM.getId('add-interval-btn');
    this.$importBtn = DOM.getId('import-btn');
    this.$exportBtn = DOM.getId('export-btn');
    this.$importInput = DOM.getId('import-file-input');

    this._initialize();
  }

  /**
   * Initialize the intervals manager by setting up event listeners.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Configure event listeners for intervals UI controls.
   */
  _listeners() {
    Events.on(this.$intervalsBtn, 'click', this.show.bind(this));
    Events.on(this.$addBtn, 'click', this.add.bind(this));
    Events.on(this.$importBtn, 'click', this.import.bind(this));
    Events.on(this.$exportBtn, 'click', this.export.bind(this));
    Events.on(this.$importInput, 'change', this.importFile.bind(this));

    Events.on(document, 'appRestarted', this.render.bind(this));

    Events.on(document, 'session_created', this.render.bind(this));
    Events.on(document, 'session_updated', this.render.bind(this));
  }

  /**
   * Create a select element for alert sound selection.
   * @param {string} selected - Currently selected alert sound value.
   * @returns {HTMLElement} Created select element.
   */
  _createAlerts(selected) {
    const $select = DOM.create('select', { className: 'interval-audio-cue' });
    const alerts = this.app.alerts ? this.app.alerts.list() : [{ value: 'Default', name: 'Default Bell' }];

    alerts.forEach((alert) => {
      const $option = DOM.create(
        'option',
        {
          value: alert.value,
          selected: alert.value === selected,
        },
        alert.name
      );
      $select.appendChild($option);
    });

    return $select;
  }

  /**
   * Create an interval element for the intervals modal.
   * @param {Object} interval - Interval data object.
   * @param {number} index - Index of the interval.
   * @returns {HTMLElement} Created interval element.
   */
  _createElement(interval, index) {
    const $interval = DOM.create('div', {
      className: 'interval-item',
      'data-index': index,
    });

    if (!this.collapsed.has(index)) {
      $interval.classList.add('collapsed');
    }

    const $intervalHeader = DOM.create('div', { className: 'interval-header' });

    const $collapseBtn = DOM.create(
      'button',
      {
        className: 'interval-collapse',
      },
      '▶'
    );

    const $nameInput = DOM.create('input', {
      type: 'text',
      className: 'interval-name',
      value: interval.name,
      placeholder: 'Interval name',
    });

    const $durationInput = DOM.create('input', {
      type: 'number',
      className: 'interval-duration',
      value: Math.floor(interval.duration / 60),
      min: 1,
      max: 1440,
      title: 'Duration (minutes)',
      placeholder: '25',
    });

    const $deleteBtn = DOM.create(
      'button',
      {
        className: 'interval-delete btn-danger btn-small',
        title: 'Delete interval',
      },
      '✖'
    );

    $intervalHeader.appendChild($collapseBtn);
    $intervalHeader.appendChild($nameInput);
    $intervalHeader.appendChild($durationInput);
    $intervalHeader.appendChild($deleteBtn);

    const $intervalDetails = DOM.create('div', { className: 'interval-details' });

    const $alertGroup = DOM.create('div', { className: 'interval-audio' });
    const $alertLabel = DOM.create('label', {}, 'Alert Sound');
    const $alertContainer = DOM.create('div', {
      className: 'interval-audio-controls',
    });
    const $alertSelect = this._createAlerts(interval.alert);
    const $testAlertBtn = DOM.create(
      'button',
      {
        type: 'button',
        className: 'test-audio-btn',
        title: 'Test alert sound',
      },
      '🔊'
    );

    $alertContainer.appendChild($alertSelect);
    $alertContainer.appendChild($testAlertBtn);
    $alertGroup.appendChild($alertLabel);
    $alertGroup.appendChild($alertContainer);

    const cssText = `/* Body Background */
body {
  background: linear-gradient(45deg, #ffeaa7, #fab1a0);
}

/* Timer Display Styling */
.timer-display {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
  border: none;
}

/* Timer Indicators */
.timer-btn {
  color: #c14242;
}

.timer-btn:hover {
  color: #971e1e;
}`;

    const $cssGroup = DOM.create('div', { className: 'interval-styles' });
    const $cssLabel = DOM.create('label', {}, 'Custom CSS');
    const $cssTextarea = DOM.create('textarea', {
      className: 'interval-css',
      placeholder: cssText,
      value: interval.customCSS,
    });
    const $cssHelp = DOM.create('small', {
      className: 'css-help',
      textContent: 'You can style any element on the page including body, buttons, or the entire interface.',
    });
    $cssGroup.appendChild($cssLabel);
    $cssGroup.appendChild($cssTextarea);
    $cssGroup.appendChild($cssHelp);

    $intervalDetails.appendChild($alertGroup);
    $intervalDetails.appendChild($cssGroup);

    $interval.appendChild($intervalHeader);
    $interval.appendChild($intervalDetails);

    Events.on($collapseBtn, 'click', () => this.toggleCollapse($interval));
    Events.on($intervalHeader, 'click', (e) => {
      if (
        e.target !== $collapseBtn &&
        e.target !== $deleteBtn &&
        e.target !== $nameInput &&
        e.target !== $durationInput
      ) {
        this.toggleCollapse($interval);
      }
    });

    Events.on($nameInput, 'blur', () => this.save(index));
    Events.on(
      $nameInput,
      'input',
      Utils.debounce(() => this.save(index), 500)
    );

    Events.on($durationInput, 'blur', () => this.save(index));
    Events.on(
      $durationInput,
      'input',
      Utils.debounce(() => this.save(index), 500)
    );

    Events.on($alertSelect, 'change', () => this.save(index));

    Events.on($testAlertBtn, 'click', (e) => {
      e.stopPropagation();
      this.app.alerts.play($alertSelect.value);
    });

    Events.on($cssTextarea, 'blur', () => this.save(index));
    Events.on(
      $cssTextarea,
      'input',
      Utils.debounce(() => this.save(index), 1000)
    );

    Events.on($deleteBtn, 'click', (e) => {
      e.stopPropagation();
      this.remove(index);
    });

    return $interval;
  }

  /**
   * Toggle the expanded/collapsed state of an interval item in the UI.
   * @param {HTMLElement} $interval - Interval item element to toggle expansion state.
   */
  toggleCollapse($interval) {
    const index = parseInt($interval.getAttribute('data-index'));

    if ($interval.classList.toggle('collapsed')) {
      this.collapsed.delete(index);
    } else {
      this.collapsed.add(index);
    }
  }

  /**
   * Export the current session configuration to a file.
   */
  export() {
    try {
      const config = this.exportToJSON();
      const data = JSON.stringify(config, null, 2);
      const blob = new Blob([data], { type: 'application/json' });

      const $link = DOM.create('a', {
        href: URL.createObjectURL(blob),
        download: `arowa-intervals-${this.app.getCurrentSessionId()}.json`,
      });

      document.body.appendChild($link);
      $link.click();
      document.body.removeChild($link);

      URL.revokeObjectURL($link.href);
    } catch (error) {
      console.error('Export error:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to export configuration');
      }
    }
  }

  /**
   * Generate exportable session configuration data.
   * @returns {Object} Session configuration object.
   */
  exportToJSON() {
    const session = this.app.getCurrentSession();

    if (
      !session ||
      !session?.intervals?.items ||
      !Array.isArray(session.intervals.items) ||
      session.intervals.items.length === 0
    )
      throw new Error('No intervals data to export');

    return {
      name: session?.name || '',
      description: session?.description || '',
      intervals: {
        lastUpdated: Number(session?.intervals?.lastUpdated || Date.now()),
        items: session.intervals.items.map((interval) => ({
          name: interval?.name || '',
          duration: Number(interval?.duration || DEFAULT_DURATION),
          alert: interval?.alert || 'Default',
          customCSS: interval?.customCSS || '',
        })),
      },
    };
  }

  /**
   * Open the file input dialog to import a configuration file.
   */
  import() {
    const $importFileInput = DOM.getId('import-file-input');
    $importFileInput.click();
  }

  /**
   * Handle the file input change event for importing a configuration file.
   * @param {Event} event - File input change event containing selected file data.
   */
  importFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      alert('Please select a valid JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        this.importFromJSON(config);
      } catch (error) {
        console.error('Import error:', error);
        if (error instanceof SyntaxError) {
          alert('Invalid JSON file format');
        } else if (error instanceof Error) {
          alert(error.message);
        } else {
          alert('Failed to import configuration');
        }
      }
    };

    reader.readAsText(file);

    event.target.value = '';
  }

  /**
   * Import a session configuration from an object with lite validation.
   * @param {Object} config - Configuration object containing session data to import.
   */
  importFromJSON(config) {
    try {
      const session = this.app.getCurrentSession();

      if (!config?.intervals?.items || !Array.isArray(config.intervals.items) || config.intervals.items.length === 0) {
        throw new Error('Missing intervals data');
      }

      session.name = config?.name ? config.name.trim().substring(0, MAX_NAME_LENGTH) : '';
      session.description = config?.description ? config.description.trim().substring(0, MAX_STRING_LENGTH) : '';

      session.intervals.lastUpdated = Date.now();
      session.intervals.items = config.intervals.items.map((interval) => ({
        name: interval?.name || '',
        duration: Math.max(MIN_DURATION, Math.min(MAX_DURATION, parseInt(interval?.duration || 0))) || DEFAULT_DURATION,
        alert: interval?.alert
          ? this.app.alerts.list().find((alert) => alert.value === interval.alert)?.value || 'Default'
          : 'Default',
        customCSS: interval?.customCSS || '', // TODO: Sanitize CSS
      }));

      // Reset timer to first interval
      // DOES NOT RESET REPEAT MODE
      session.timer.interval = 0;
      session.timer.remaining = session.intervals.items[0].duration * 1000;
      session.timer.isRunning = false;
      session.timer.isPaused = false;
      session.timer.startedAt = 0;
      session.timer.startedInterval = 0;
      session.timer.pausedAt = 0;
      session.timer.timePaused = 0;

      this.app.saveCurrentSession();

      this.app.socket.sessionUpdate(session, true);

      this.app.settings.render();
      this.app.sessions.render();
      this.app.timer.reload(true);
      this.render();

      alert('Configuration imported successfully');
    } catch (error) {
      console.error('Import error:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to import configuration');
      }
    }
  }

  /**
   * Render the intervals list in the modal.
   */
  render() {
    const session = this.app.getCurrentSession();

    this.$intervalsList.innerHTML = '';

    if (!session || session.intervals.items.length === 0) return;

    session.intervals.items.forEach((interval, index) => {
      const $element = this._createElement(interval, index);
      this.$intervalsList.appendChild($element);
    });
  }

  /**
   * Display intervals configuration modal.
   */
  show() {
    this.render();
    DOM.showModal('intervals-modal');
  }

  /**
   * Add a new interval to the session.
   */
  add() {
    const session = this.app.getCurrentSession();
    if (!session) return;

    const newInterval = {
      name: 'New Interval',
      duration: DEFAULT_DURATION,
      alert: 'Default',
      customCSS: `/* Timer Display Styling */
#timer-display {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  font-size: 4rem;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
  border: none;
}

/* Timer Indicators */
.timer-btn {
  color: #c14242;
}

.timer-btn:hover {
  color: #971e1e;
}

/* Body Background */
body {
  background: linear-gradient(45deg, #ffeaa7, #fab1a0);
  transition: background 0.5s ease;
}

/* Controls Styling */
.control-btn {
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
}`,
    };

    session.intervals.items.push(newInterval);
    session.intervals.lastUpdated = Date.now();

    this.app.saveCurrentSession();
    this.app.socket.sessionUpdate(session);

    this.render();
  }

  /**
   * Delete an interval from the session.
   * @param {number} index - Index of the interval to delete from the session.
   */
  async remove(index) {
    const session = this.app.getCurrentSession();
    if (!session || session.intervals.items.length <= 1) {
      alert('Cannot delete the last interval');
      return;
    }

    const confirmed = await Utils.showConfirm('Delete this interval?');
    if (!confirmed) return;

    session.intervals.items.splice(index, 1);
    session.intervals.lastUpdated = Date.now();

    this.app.timer.updateIntervals();

    this.app.saveCurrentSession();
    this.app.socket.sessionUpdate(session);

    this.render();
    this.app.timer.render();
  }

  /**
   * Save the data for a specific interval and sync with server.
   * @param {number} index - Index of the interval to save changes for.
   */
  save(index) {
    if (this.isUpdating) return;

    const session = this.app.getCurrentSession();
    if (!session || !session.intervals.items[index]) return;

    const $intervalItem = DOM.query(`[data-index="${index}"]`);
    if (!$intervalItem) return;

    const $nameInput = $intervalItem.querySelector('.interval-name');
    const $durationInput = $intervalItem.querySelector('.interval-duration');
    const $alertSelect = $intervalItem.querySelector('.interval-audio-cue');
    const $cssTextarea = $intervalItem.querySelector('.interval-css');

    const interval = session.intervals.items[index];
    const oldDuration = interval.duration;

    interval.name = $nameInput.value.trim();
    interval.alert = $alertSelect.value;
    interval.customCSS = $cssTextarea.value;

    const minutes = parseInt($durationInput.value) || 1;
    interval.duration = Math.max(1, Math.min(1440, minutes)) * 60; // Convert to seconds

    session.intervals.lastUpdated = Date.now();

    this.app.saveCurrentSession();
    this.app.socket.sessionUpdate(session);

    const timer = this.app.timer.getState();
    if (timer.interval === index && oldDuration !== interval.duration) {
      this.app.timer.updateIntervals();
      this.app.timer.render();
    }
  }
}

export default IntervalsManager;
