package ac.uk.sussex.kn253.repository;

import ac.uk.sussex.kn253.model.TimeSlot;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TimeSlotRepository implements PanacheRepository<TimeSlot> {
}
