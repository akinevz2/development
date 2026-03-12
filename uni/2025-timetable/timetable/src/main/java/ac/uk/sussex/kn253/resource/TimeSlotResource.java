package ac.uk.sussex.kn253.resource;

import ac.uk.sussex.kn253.service.TimeSlotService;
import ac.uk.sussex.kn253.service.ui.Widget;
import ac.uk.sussex.kn253.service.ui.WidgetProvider;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/timeslots")
@ApplicationScoped
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class TimeSlotResource implements WidgetProvider<TimeSlotResource> {

    @Inject
    TimeSlotService timeSlotService;

    @POST
    @Path("/validate")
    public Response validateTimeSlot(final String timeSlotString) {
        return Response.ok(timeSlotService.isValidTimeSlot(timeSlotString)).build();
    }

    @POST
    @Path("/parse")
    public Response parseTimeSlot(final String timeSlotString) {
        final var timeSlot = timeSlotService.parseTimeSlot(timeSlotString);
        if (timeSlot == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid time slot format").build();
        }
        return Response.ok(timeSlot).build();
    }

    @Override
    public Widget getWidget() {
        return new Widget() {
            // This widget displays all timeslots that have been created on this calendar,
            // allows user to click them to remove them.

            @Override
            public String content() {
                return """
                        <div class="timeslot-widget">
                            <h2>Time Slot Widget</h2>
                            <p>This widget can be used to validate and parse time slots.</p>
                        </div>
                        """;
            }

        };
    }

}