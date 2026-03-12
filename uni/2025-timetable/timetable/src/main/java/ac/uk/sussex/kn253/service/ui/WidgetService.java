package ac.uk.sussex.kn253.service.ui;

import ac.uk.sussex.kn253.model.CourseModule;
import ac.uk.sussex.kn253.model.Timetable;
import ac.uk.sussex.kn253.resource.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class WidgetService {

    @Inject
    ModuleResource moduleResource;

    @Inject
    TimeSlotResource timeSlotResource;

    @Inject
    TimetableResource timetableResource;

    public Widget timetable() {
        return timetableResource.getWidget();
    }

    public Widget entries() {
        return timeSlotResource.getWidget();
    }

    public Widget modules() {
        return moduleResource.getWidget();
    }

    public Widget module(final CourseModule module) {
        return () -> """
                <li class="module-item" data-module-id="%s">
                    <h3>%s %s</h3>
                </li>
                """.formatted(module.id, module.getCode(), module.getName());
    }

    public Widget timetable(final Timetable timetable) {
        return () -> """
                <div class="timetable-widget" data-timetable-id="%s">
                    <h2>%s</h2>
                </div>
                """.formatted(timetable.id, timetable.getName());
    }

}