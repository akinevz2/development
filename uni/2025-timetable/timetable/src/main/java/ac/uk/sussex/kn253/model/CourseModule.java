package ac.uk.sussex.kn253.model;

import java.util.Objects;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;

@Entity
public class CourseModule extends PanacheEntity {
    private String name;
    private String code;

    @JoinColumn(name = "timetable_id")
    private Timetable timetable;

    public CourseModule() {
    }

    public CourseModule(final String name, final String color) {
        this.name = name;
        this.code = color;
    }

    public String getName() {
        return name;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(final String color) {
        this.code = color;
    }

    @Override
    public boolean equals(final Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        final CourseModule module = (CourseModule) o;
        return Objects.equals(name, module.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name);
    }

    @Override
    public String toString() {
        return "Module{" +
                "name='" + name + '\'' +
                ", color='" + code + '\'' +
                '}';
    }

    /**
     * @return the timetable
     */
    public Timetable getTimetable() {
        return timetable;
    }

    /**
     * @param timetable the timetable to set
     */
    public void setTimetable(final Timetable timetable) {
        this.timetable = timetable;
    }
}