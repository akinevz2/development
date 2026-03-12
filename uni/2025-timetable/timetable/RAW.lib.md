# RAW Library Documentation

The RAW (Response and Widget) library is a JavaScript helper library designed to fetch and render widgets from the backend into frontend HTML elements.

## Overview

RAW provides a simple API to load widgets from the backend and render them into specified HTML containers. It supports caching, error handling, and custom widget providers.

## Installation

The RAW library is already included in the project. It's loaded in `index.html`:

```html
<script src="js/raw.js"></script>
```

## Usage

### Basic Widget Loading

To load a widget from the backend and render it into an HTML element:

```javascript
RAW.loadWidget("widgetType", "containerId", { params });
```

**Parameters:**

- `widgetType` (string): Type of widget to load (e.g., 'modules', 'entries', 'timetable', 'login')
- `containerId` (string): ID of the HTML element to render the widget into
- `params` (object, optional): Optional parameters to pass to the widget

### Example Usage

```javascript
// Load the modules widget
RAW.loadWidget("modules", "modules-fragment");

// Load the timetable entries widget with parameters
RAW.loadWidget("entries", "timetable-entries-fragment", {
  moduleId: "CS101",
  semester: "1",
});

// Load the login widget
RAW.loadWidget("login", "login-form");
```

### Asynchronous Loading

The `loadWidget` method returns a Promise that resolves when the widget has been loaded and rendered:

```javascript
async function loadWidgets() {
  try {
    await RAW.loadWidget("modules", "modules-fragment");
    await RAW.loadWidget("entries", "timetable-entries-fragment");
    console.log("All widgets loaded successfully");
  } catch (error) {
    console.error("Error loading widgets:", error);
  }
}
```

## API Reference

### `loadWidget(widgetType, containerId, params)`

Fetches a widget from the backend and renders it into the specified container.

**Returns:** `Promise<void>`

### `registerWidgetProvider(widgetType, provider)`

Registers a custom widget provider function for a specific widget type.

**Parameters:**

- `widgetType` (string): Type of widget to register
- `provider` (Function): Function that returns widget data

### `clearCache()`

Clears the widget cache.

### `getCachedWidget(widgetType, params)`

Retrieves a widget from the cache.

**Returns:** Cached widget data or null

### `renderWidget(container, widgetData)`

Renders widget data into the specified container.

### `renderStructuredWidget(widgetData)`

Renders structured widget data as HTML.

## Backend Integration

The RAW library communicates with backend endpoints at `/ui/fragments/{widgetType}`. The backend should return HTML content for the widget.

## Error Handling

The library includes built-in error handling that displays error messages in the container when widget loading fails.

## Caching

RAW automatically caches widget responses to improve performance. The cache is keyed by widget type and parameters.

## Example Implementation

In `index.html`, widgets are loaded when the page loads:

```javascript
document.addEventListener("DOMContentLoaded", function () {
  // Load widgets using RAW
  RAW.loadWidget("calendar", "calendar-fragment");
  RAW.loadWidget("modules", "modules-fragment");
  RAW.loadWidget("entries", "timetable-entries-fragment");
  RAW.loadWidget("login", "login-form");
});
```

## Custom Widget Providers

You can register custom widget providers for advanced use cases:

```javascript
RAW.registerWidgetProvider("custom-widget", async (params) => {
  // Custom logic to fetch or generate widget data
  return {
    html: "<div>Custom Widget Content</div>",
  };
});
```
