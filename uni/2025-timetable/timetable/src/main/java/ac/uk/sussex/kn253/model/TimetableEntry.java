package ac.uk.sussex.kn253.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

@Entity
public class TimetableEntry extends PanacheEntity {

    public TimetableEntry() {
    }

    @ManyToOne
    @JoinColumn(name = "module_id")
    private CourseModule module;
    @ManyToOne
    @JoinColumn(name = "location_id")
    private Location location;
    private WeekDay day;
    @ManyToOne
    @JoinColumn(name = "timeslot_id")
    private TimeSlot timeSlot;

    public TimetableEntry(final CourseModule module, final Location location, final WeekDay day,
            final TimeSlot timeSlot) {
        this.module = module;
        this.location = location;
        this.day = day;
        this.timeSlot = timeSlot;
    }

    /**
     * @return the module
     */
    public CourseModule getModule() {
        return module;
    }

    /**
     * @param module the module to set
     */
    public void setModule(final CourseModule module) {
        this.module = module;
    }

    /**
     * @return the location
     */
    public Location getLocation() {
        return location;
    }

    /**
     * @param location the location to set
     */
    public void setLocation(final Location location) {
        this.location = location;
    }

    /**
     * @return the day
     */
    public WeekDay getDay() {
        return day;
    }

    /**
     * @param day the day to set
     */
    public void setDay(final WeekDay day) {
        this.day = day;
    }

    /**
     * @return the timeSlot
     */
    public TimeSlot getTimeSlot() {
        return timeSlot;
    }

    /**
     * @param timeSlot the timeSlot to set
     */
    public void setTimeSlot(final TimeSlot timeSlot) {
        this.timeSlot = timeSlot;
    }

}