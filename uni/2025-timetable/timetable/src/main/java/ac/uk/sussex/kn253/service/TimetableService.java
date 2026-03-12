package ac.uk.sussex.kn253.service;

import java.util.List;

import ac.uk.sussex.kn253.model.CourseModule;
import ac.uk.sussex.kn253.model.Timetable;
import ac.uk.sussex.kn253.repository.ModuleRepository;
import ac.uk.sussex.kn253.repository.TimetableRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class TimetableService {

    @Inject
    TimetableRepository timetableRepository;

    @Inject
    ModuleRepository moduleRepository;

    public void clearAllEntries() {
        timetableRepository.deleteAll();
    }

    public Timetable getEntry(final int id) {
        return timetableRepository.find("id = ?1", id).firstResult();
    }

    public void saveEntry(final Timetable entry) {
        timetableRepository.persist(entry);
    }

    public void deleteEntry(final Timetable entry) {
        timetableRepository.delete(entry);
    }

    public List<CourseModule> findModules(final Timetable timetable) {
        return moduleRepository.find("timetable_id = ?1", timetable.id).list();
    }

}
