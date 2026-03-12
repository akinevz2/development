package ac.uk.sussex.kn253.repository;

import ac.uk.sussex.kn253.model.Timetable;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TimetableRepository implements PanacheRepository<Timetable> {

    public Timetable findByName(final String timetableName) {
        return find("name", timetableName).firstResult();
    }
}
