package ac.uk.sussex.kn253.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;

@Entity
public class Action extends PanacheEntity {
    private String description;
    private String day;
    private String time;

    public Action() {
    }

    public Action(final String description, final String day, final String time) {
        this.description = description;
        this.day = day;
        this.time = time;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(final String description) {
        this.description = description;
    }

    public String getDay() {
        return day;
    }

    public void setDay(final String day) {
        this.day = day;
    }

    public String getTime() {
        return time;
    }

    public void setTime(final String time) {
        this.time = time;
    }

    @Override
    public String toString() {
        return "Action{" +
                "id='" + id + '\'' +
                ", description='" + description + '\'' +
                ", day='" + day + '\'' +
                ", time='" + time + '\'' +
                '}';
    }
}