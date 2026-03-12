package ac.uk.sussex.kn253.model;

import java.time.LocalTime;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;

@Entity
public class TimeSlot extends PanacheEntity {
    private LocalTime startTime;
    private LocalTime endTime;

    public TimeSlot(final LocalTime startTime2, final LocalTime endTime2) {
        this.startTime = startTime2;
        this.endTime = endTime2;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(final LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(final LocalTime endTime) {
        this.endTime = endTime;
    }

    @Override
    public String toString() {
        return "TimeSlot{" +
                "startTime=" + startTime +
                ", endTime=" + endTime +
                '}';
    }

    public LocalTime[] getLocalTimes() {
        return new LocalTime[] { startTime, endTime };
    }
}