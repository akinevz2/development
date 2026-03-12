package ac.uk.sussex.kn253.model;

import java.util.List;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

@Entity
public class Timetable extends PanacheEntity {

    private String name;
    private List<WeekDay> days;
    @Column(name = "entries")
    private List<TimetableEntry> entries;

    @Column(name = "session_id")
    private UUID sessionId;

    public Timetable() {
    }

    public Timetable(final String name, final List<WeekDay> days, final List<TimetableEntry> entries) {
        this.name = name;
        this.days = days;
        this.entries = entries;
    }

    public String getName() {
        return name;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public List<WeekDay> getDays() {
        return days;
    }

    public void setDays(final List<WeekDay> days) {
        this.days = days;
    }

    public List<TimetableEntry> getEntries() {
        return entries;
    }

    public void setEntries(final List<TimetableEntry> entries) {
        this.entries = entries;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public void setSessionId(final UUID sessionId) {
        this.sessionId = sessionId;
    }

    @Override
    public String toString() {
        return "Calendar{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", days=" + days +
                ", entries=" + entries +
                ", sessionId=" + sessionId +
                '}';
    }
}