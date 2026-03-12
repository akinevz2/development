package ac.uk.sussex.kn253.resource;

import ac.uk.sussex.kn253.service.SessionService;
import ac.uk.sussex.kn253.service.TimetableService;
import ac.uk.sussex.kn253.service.ui.*;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

@Path("/api/modules")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ModuleResource implements WidgetProvider<ModuleResource> {

    @Inject
    SessionService sessionService;

    @Inject
    WidgetService widgetService;

    @Inject
    TimetableService timetableService;

    @Override
    public Widget getWidget() {
        final var timetable = sessionService.getActiveTimetable();
        final var modules = timetableService.findModules(timetable);
        final var modulesListItems = modules.stream()
                .map(widgetService::module)
                .map(Widget::content)
                .reduce("", String::concat);
        final String content = """
                <div class="module-widget">
                    <h2>Module Widget</h2>
                    <p>This widget can be used to display modules and their details.</p>
                    <ul>
                        %s
                    </ul>
                </div>
                """.formatted(modulesListItems);
        return new Widget() {
            @Override
            public String content() {
                return content;
            };
        };
    }
}