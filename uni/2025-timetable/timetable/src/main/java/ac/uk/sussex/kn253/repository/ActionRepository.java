package ac.uk.sussex.kn253.repository;

import ac.uk.sussex.kn253.model.Action;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ActionRepository implements PanacheRepository<Action> {
}
