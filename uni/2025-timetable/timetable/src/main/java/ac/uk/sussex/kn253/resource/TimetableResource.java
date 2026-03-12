package ac.uk.sussex.kn253.resource;

import java.util.List;
import java.util.UUID;

import ac.uk.sussex.kn253.model.Timetable;
import ac.uk.sussex.kn253.service.SessionService;
import ac.uk.sussex.kn253.service.ui.Widget;
import ac.uk.sussex.kn253.service.ui.WidgetProvider;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

@Path("/api/timetable")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TimetableResource implements WidgetProvider<TimetableResource> {

    @Inject
    SessionService sessionCalendarService;

    @Inject
    SessionService sessionService;

    @Override
    public Widget getWidget() {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'getWidget'");
    }

    @GET
    @Path("/session")
    public Response getSessionTimetables(@Context final HttpHeaders headers) {
        final UUID sessionId = getSessionId(headers);
        if (sessionId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        // Get timetables for this session
        final List<Timetable> timetables = sessionCalendarService.getCalendarsForSession(sessionId);
        return Response.ok(timetables).build();
    }

    @POST
    @Path("/session")
    public Response createSessionTimetable(final Timetable timetable, @Context final HttpHeaders headers) {
        final UUID sessionId = getSessionId(headers);
        if (sessionId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        // Set the session ID on the timetable
        timetable.setSessionId(sessionId);

        final Timetable savedTimetable = sessionCalendarService.saveCalendarForSession(timetable, sessionId);
        return Response.ok(savedTimetable).build();
    }

    @PUT
    @Path("/session/{id}")
    public Response updateSessionTimetable(@PathParam("id") final int id, final Timetable timetable,
            @Context final HttpHeaders headers) {
        final UUID sessionId = getSessionId(headers);
        if (sessionId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        // Find existing timetable by ID (not by name)
        final Timetable existingTimetable = sessionCalendarService.getCalendarByIdForSession(sessionId, id);
        if (existingTimetable == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        // Verify the timetable belongs to this session
        if (existingTimetable.getSessionId() != null && !existingTimetable.getSessionId().equals(sessionId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        // Update the timetable with session ID
        timetable.setSessionId(sessionId);

        // Update the timetable
        existingTimetable.setName(timetable.getName());
        existingTimetable.setDays(timetable.getDays());
        existingTimetable.setEntries(timetable.getEntries());

        final Timetable updatedTimetable = sessionCalendarService.saveCalendarForSession(existingTimetable, sessionId);
        return Response.ok(updatedTimetable).build();
    }

    @DELETE
    @Path("/session/{id}")
    public Response deleteSessionTimetable(@PathParam("id") final int id, @Context final HttpHeaders headers) {
        final UUID sessionId = getSessionId(headers);
        if (sessionId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        // Find the timetable by ID
        final Timetable existingTimetable = sessionCalendarService.getCalendarByIdForSession(sessionId, id);
        if (existingTimetable == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        // Verify the timetable belongs to this session
        if (existingTimetable.getSessionId() != null && !existingTimetable.getSessionId().equals(sessionId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        sessionCalendarService.deleteCalendarForSession(existingTimetable, sessionId);
        return Response.noContent().build();
    }

    private UUID getSessionId(final HttpHeaders headers) {
        // Try to get session ID from header first
        final String sessionIdHeader = headers.getHeaderString("X-Session-ID");
        if (sessionIdHeader != null && !sessionIdHeader.isEmpty()) {
            try {
                return UUID.fromString(sessionIdHeader);
            } catch (final IllegalArgumentException e) {
                // Invalid UUID format
                return null;
            }
        }

        // If no session ID header, generate a new one
        return sessionService.generateSessionId();
    }

}
