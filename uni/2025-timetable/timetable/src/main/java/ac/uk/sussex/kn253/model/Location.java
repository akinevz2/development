package ac.uk.sussex.kn253.model;

import java.util.Objects;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;

@Entity
public class Location extends PanacheEntity {
    private String id;
    private String name;
    private String building;
    private String room;

    public Location() {
    }

    public Location(final String id, final String name, final String building, final String room) {
        this.id = id;
        this.name = name;
        this.building = building;
        this.room = room;
    }

    public String getId() {
        return id;
    }

    public void setId(final String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public String getBuilding() {
        return building;
    }

    public void setBuilding(final String building) {
        this.building = building;
    }

    public String getRoom() {
        return room;
    }

    public void setRoom(final String room) {
        this.room = room;
    }

    @Override
    public boolean equals(final Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        final Location location = (Location) o;
        return Objects.equals(id, location.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Location{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", building='" + building + '\'' +
                ", room='" + room + '\'' +
                '}';
    }
}