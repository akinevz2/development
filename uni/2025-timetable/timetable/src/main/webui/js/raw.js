/**
 * RAW (Response and Widget) Helper Library
 * A simple library to fetch and render widgets from the backend
 */

class RAW {
  constructor() {
    this.cache = new Map();
    this.widgetProviders = new Map();
    this.sessionId = this.getSessionId();
  }

  /**
   * Get or generate a session ID for this browser session
   * @returns {string} UUID session ID
   */
  getSessionId() {
    // Try to get existing session ID from localStorage
    let sessionId = localStorage.getItem("timetable-session-id");

    // If no session ID exists, generate a new one
    if (!sessionId) {
      sessionId = this.generateUUID();
      localStorage.setItem("timetable-session-id", sessionId);
    }

    return sessionId;
  }

  /**
   * Generate a UUID (v4)
   * @returns {string} UUID string
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  /**
   * Load a widget from the backend and emplace it into the specified container
   * @param {string} widgetType - Type of widget to load (e.g., 'modules', 'entries', 'timetable', 'login')
   * @param {string} containerId - ID of the HTML element to render the widget into
   * @param {Object} params - Optional parameters to pass to the widget
   * @returns {Promise<void>}
   */
  async loadWidget(widgetType, containerId, params = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }

    try {
      // Check cache first
      const cacheKey = `${widgetType}-${JSON.stringify(params)}`;
      if (this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        this.renderWidget(container, cachedData);
        return;
      }

      // Fetch widget from backend
      const response = await fetch(`/ui/fragments/${widgetType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": this.sessionId,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch widget: ${response.status} ${response.statusText}`,
        );
      }

      const widgetData = await response.json();

      // Cache the widget data
      this.cache.set(cacheKey, widgetData);

      // Render the widget
      this.renderWidget(container, widgetData);
    } catch (error) {
      console.error("Error loading widget:", error);
      container.innerHTML = `<div class="error">Failed to load widget: ${error.message}</div>`;
    }
  }

  /**
   * Load a timetable widget specifically (handles session-based timetable operations)
   * @param {string} containerId - ID of the HTML element to render the timetable into
   * @param {Object} params - Optional parameters to pass to the timetable widget
   * @returns {Promise<void>}
   */
  async loadTimetable(containerId, params = {}) {
    return this.loadWidget("timetable", containerId, params);
  }

  /**
   * Render widget data into the container
   * @param {HTMLElement} container - Container element to render into
   * @param {Object} widgetData - Data returned from the backend
   */
  renderWidget(container, widgetData) {
    if (typeof widgetData === "string") {
      // If widgetData is a string, treat it as HTML
      container.innerHTML = widgetData;
    } else {
      // If widgetData is an object, render it as structured data
      container.innerHTML = this.renderStructuredWidget(widgetData);
    }
  }

  /**
   * Render structured widget data
   * @param {Object} widgetData - Structured widget data
   * @returns {string} HTML string
   */
  renderStructuredWidget(widgetData) {
    if (!widgetData) return "";

    // Handle different widget data structures
    if (widgetData.html) {
      return widgetData.html;
    }

    if (widgetData.content) {
      return widgetData.content;
    }

    // Default rendering for object data
    return `<pre>${JSON.stringify(widgetData, null, 2)}</pre>`;
  }

  /**
   * Register a custom widget provider
   * @param {string} widgetType - Type of widget to register
   * @param {Function} provider - Function that returns widget data
   */
  registerWidgetProvider(widgetType, provider) {
    this.widgetProviders.set(widgetType, provider);
  }

  /**
   * Clear the widget cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get widget from cache
   * @param {string} widgetType - Type of widget
   * @param {Object} params - Parameters used for the widget
   * @returns {Object|null} Cached widget data or null
   */
  getCachedWidget(widgetType, params = {}) {
    const cacheKey = `${widgetType}-${JSON.stringify(params)}`;
    return this.cache.get(cacheKey) || null;
  }
}

// Create a global instance of RAW
const raw = new RAW();

// Make RAW available globally
window.RAW = raw;
