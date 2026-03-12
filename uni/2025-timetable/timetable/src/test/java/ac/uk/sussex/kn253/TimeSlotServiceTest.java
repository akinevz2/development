package ac.uk.sussex.kn253;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ac.uk.sussex.kn253.service.TimeSlotService;

public class TimeSlotServiceTest {

    private TimeSlotService timeSlotService;

    @BeforeEach
    public void setUp() {
        timeSlotService = new TimeSlotService();
    }

    @Test
    public void testValidTimeSlot() {
        assertTrue(timeSlotService.isValidTimeSlot("09:00-10:30"));
        assertTrue(timeSlotService.isValidTimeSlot("14:15-15:45"));
        assertTrue(timeSlotService.isValidTimeSlot("08:00-09:00"));
        assertTrue(timeSlotService.isValidTimeSlot("18:30-20:00"));
    }

    @Test
    public void testInvalidTimeSlot() {
        assertFalse(timeSlotService.isValidTimeSlot("10:30-09:00")); // End time before start time
        assertFalse(timeSlotService.isValidTimeSlot("09:00-09:00")); // Same start and end time
        assertFalse(timeSlotService.isValidTimeSlot("09:00")); // Missing dash
        assertFalse(timeSlotService.isValidTimeSlot("09:00-10:30-11:00")); // Too many dashes
        assertFalse(timeSlotService.isValidTimeSlot("25:00-26:00")); // Invalid time
        assertFalse(timeSlotService.isValidTimeSlot("09:60-10:00")); // Invalid minutes
        assertFalse(timeSlotService.isValidTimeSlot("")); // Empty string
        assertFalse(timeSlotService.isValidTimeSlot(null)); // Null string
    }

    @Test
    public void testParseTimeSlot() {
        LocalTime[] times = timeSlotService.parseTimeSlot("09:00-10:30");
        assertNotNull(times);
        assertEquals(2, times.length);
        assertEquals(LocalTime.of(9, 0), times[0]);
        assertEquals(LocalTime.of(10, 30), times[1]);

        times = timeSlotService.parseTimeSlot("14:15-15:45");
        assertNotNull(times);
        assertEquals(2, times.length);
        assertEquals(LocalTime.of(14, 15), times[0]);
        assertEquals(LocalTime.of(15, 45), times[1]);
    }

    @Test
    public void testParseInvalidTimeSlot() {
        assertNull(timeSlotService.parseTimeSlot("10:30-09:00")); // Invalid time range
        assertNull(timeSlotService.parseTimeSlot("")); // Empty string
        assertNull(timeSlotService.parseTimeSlot(null)); // Null string
    }
}