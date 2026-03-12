# Timetable Application

A comprehensive timetable management system built with Java, Spring Boot, and a modern web UI.

## Overview

This application provides a complete timetable management solution with features for managing courses, time slots, locations, and timetable entries. It includes both a REST API backend and a web-based user interface.

## Features

- Course and module management
- Time slot scheduling
- Location management
- Timetable entry creation and management
- RESTful API for integration
- Web-based user interface
- Authentication and session management

## Project Structure

```
src/
├── main/
│   ├── java/
│   │   └── ac/uk/sussex/kn253/
│   │       ├── model/          # Data models
│   │       ├── repository/     # Data access layer
│   │       ├── service/        # Business logic
│   │       │   └── ui/         # UI-related services
│   │       ├── resource/       # REST endpoints
│   │       └── service/        # Business logic services
│   ├── webui/                  # Web UI files
│   │   ├── index.html          # Main UI page
│   │   ├── styles.css          # Stylesheet
│   │   └── js/raw.js           # JavaScript functionality
│   └── resources/
│       └── application.properties  # Application configuration
└── test/
    └── java/
        └── ac/uk/sussex/kn253/
            └── TimeSlotServiceTest.java # Test cases
```

## Technologies Used

- **Backend**: Java 17, Spring Boot, REST API
- **Frontend**: HTML, CSS, JavaScript
- **Database**: (Configuration in application.properties)
- **Build Tool**: Maven

## Getting Started

### Prerequisites

- Java 17 or higher
- Maven 3.6 or higher
- Node.js (for web UI development, if needed)

### Running the Application

To run the application in development mode:

```bash
./mvnw quarkus:dev
```

The application will be available at `http://localhost:8080`

### Building the Application

To package the application:

```bash
./mvnw package
```

This will create a runnable JAR file in the `target/quarkus-app/` directory.

### Creating a Native Executable

To create a native executable:

```bash
./mvnw package -Dnative
```

## API Endpoints

The application exposes REST endpoints for managing timetable data:

- **Timetable**: `/api/timetable`
- **Time Slots**: `/api/timeslots`
- **Modules**: `/api/modules`
- **Locations**: `/api/locations`
- **Widgets**: `/api/widgets`

## Key Components

### Models

- `Timetable.java` - Main timetable entity
- `TimetableEntry.java` - Individual timetable entries
- `TimeSlot.java` - Time slot definitions
- `Location.java` - Location information
- `CourseModule.java` - Course module relationships

### Services

- `TimetableService.java` - Core timetable business logic
- `TimeSlotService.java` - Time slot management
- `WidgetService.java` - UI widget management
- `AuthService.java` - Authentication handling

### Resources

- `TimetableResource.java` - REST endpoints for timetable data
- `TimeSlotResource.java` - REST endpoints for time slots
- `ModuleResource.java` - REST endpoints for modules
- `WidgetResource.java` - REST endpoints for widgets

## Testing

The project includes unit tests for core functionality:

- `TimeSlotServiceTest.java` - Tests for time slot service

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Java and Spring Boot
- Web UI components
