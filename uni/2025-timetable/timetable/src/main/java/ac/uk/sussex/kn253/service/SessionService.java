package ac.uk.sussex.kn253.service;

import java.util.List;
import java.util.UUID;

import ac.uk.sussex.kn253.model.Timetable;
import ac.uk.sussex.kn253.repository.TimetableRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class SessionService {

    @Inject
    TimetableRepository timetableRepository;

    public List<Timetable> getCalendarsForSession(final UUID sessionId) {
        return timetableRepository.find("sessionId = ?1", sessionId).list();
    }

    public Timetable getCalendarForSession(final UUID sessionId, final String calendarName) {
        return timetableRepository.find("sessionId = ?1 AND name = ?2", sessionId, calendarName).firstResult();
    }

    public Timetable getCalendarByIdForSession(final UUID sessionId, final int id) {
        return timetableRepository.find("sessionId = ?1 AND id = ?2", sessionId, id).firstResult();
    }

    public Timetable saveCalendarForSession(final Timetable calendar, final UUID sessionId) {
        calendar.setSessionId(sessionId);
        timetableRepository.persist(calendar);
        return calendar;
    }

    public void deleteCalendarForSession(final Timetable calendar, final UUID sessionId) {
        if (calendar.getSessionId() != null && calendar.getSessionId().equals(sessionId)) {
            timetableRepository.delete(calendar);
        }
    }

    public Timetable createDefaultCalendar(final UUID sessionId) {
        // Create a default calendar for the session
        final Timetable defaultCalendar = new Timetable();
        defaultCalendar.setName("Default Calendar");
        defaultCalendar.setSessionId(sessionId);
        timetableRepository.persist(defaultCalendar);
        return defaultCalendar;
    }

    public UUID generateSessionId() {
        return UUID.randomUUID();
    }

    public Timetable getActiveTimetable() {
        // get the current session id
        final UUID sessionId = getCurrentSessionId();
        if (sessionId == null) {
            return null;
        }
        return getCalendarForSession(sessionId, "Default Calendar");
    }

    private UUID getCurrentSessionId() {
        // TODO: Implement logic to get the current session ID
        throw new UnsupportedOperationException("Unimplemented method 'getCurrentSessionId'");
    }
}
