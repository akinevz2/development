package ac.uk.sussex.kn253.resource;

import ac.uk.sussex.kn253.service.ui.WidgetService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

@Path("/ui/fragments")
public class WidgetResource {

    @Inject
    WidgetService widgetService;

    @GET
    @Path("/modules")
    @Produces(MediaType.TEXT_HTML)
    public String getModuleWidget() {
        return widgetService.modules().content();
    }

    @GET
    @Path("/entries")
    @Produces(MediaType.TEXT_HTML)
    public String getTimetableEntryWidget() {
        return widgetService.entries().content();
    }

    @GET
    @Path("/timetable")
    @Produces(MediaType.TEXT_HTML)
    public String getTimetableWidget() {
        return widgetService.timetable().content();
    }

}