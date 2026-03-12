package ac.uk.sussex.kn253.service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TimeSlotService {

    // Pattern to match time formats like "09:00-10:30" or "09:00-10:30"
    private static final Pattern TIME_SLOT_PATTERN = Pattern.compile("^\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}$");

    /**
     * Validates if a string represents a valid time slot in the format
     * "HH:MM-HH:MM"
     * 
     * @param timeSlotString the string to validate
     * @return true if valid, false otherwise
     */
    public boolean isValidTimeSlot(String timeSlotString) {
        if (timeSlotString == null || timeSlotString.trim().isEmpty()) {
            return false;
        }

        // Trim whitespace
        timeSlotString = timeSlotString.trim();

        // Check basic format
        if (!TIME_SLOT_PATTERN.matcher(timeSlotString).matches()) {
            return false;
        }

        try {
            // Split the string by dash
            final String[] parts = timeSlotString.split("-");
            if (parts.length != 2) {
                return false;
            }

            final String startTimeStr = parts[0];
            final String endTimeStr = parts[1];

            // Parse start and end times
            final LocalTime startTime = LocalTime.parse(startTimeStr, DateTimeFormatter.ofPattern("HH:mm"));
            final LocalTime endTime = LocalTime.parse(endTimeStr, DateTimeFormatter.ofPattern("HH:mm"));

            // Validate that end time is strictly after start time (same time is not
            // allowed)
            return endTime.isAfter(startTime);
        } catch (final DateTimeParseException e) {
            return false;
        }
    }

    /**
     * Parses a time slot string into start and end times
     * 
     * @param timeSlotString the time slot string in format "HH:MM-HH:MM"
     * @return an array where index 0 is start time and index 1 is end time, or null
     *         if invalid
     */
    public LocalTime[] parseTimeSlot(final String timeSlotString) {
        if (!isValidTimeSlot(timeSlotString)) {
            return null;
        }

        try {
            final String[] parts = timeSlotString.trim().split("-");
            final LocalTime startTime = LocalTime.parse(parts[0], DateTimeFormatter.ofPattern("HH:mm"));
            final LocalTime endTime = LocalTime.parse(parts[1], DateTimeFormatter.ofPattern("HH:mm"));
            return new LocalTime[] { startTime, endTime };
        } catch (final DateTimeParseException e) {
            return null;
        }
    }

    /**
     * Helper class to hold parse results
     */
    public static class TimeSlotParseResult {
        private final LocalTime startTime;
        private final LocalTime endTime;

        public TimeSlotParseResult(final LocalTime startTime, final LocalTime endTime) {
            this.startTime = startTime;
            this.endTime = endTime;
        }

        public LocalTime getStartTime() {
            return startTime;
        }

        public LocalTime getEndTime() {
            return endTime;
        }
    }

    /**
     * Validates a time slot string
     * 
     * @param timeSlotString the time slot string to validate
     * @return true if valid, false otherwise
     */
    public boolean validateTimeSlotString(final String timeSlotString) {
        return isValidTimeSlot(timeSlotString);
    }

    /**
     * Parses a time slot string into start and end times
     * 
     * @param timeSlotString the time slot string in format "HH:MM-HH:MM"
     * @return a TimeSlotParseResult object, or null if invalid
     */
    public TimeSlotParseResult parseTimeSlotString(final String timeSlotString) {
        final LocalTime[] times = parseTimeSlot(timeSlotString);
        if (times == null) {
            return null;
        }
        return new TimeSlotParseResult(times[0], times[1]);
    }

}
