package ac.uk.sussex.kn253.model;

public enum WeekDay {
    MONDAY("1", "Monday", 1),
    TUESDAY("2", "Tuesday", 2),
    WEDNESDAY("3", "Wednesday", 3),
    THURSDAY("4", "Thursday", 4),
    FRIDAY("5", "Friday", 5),
    SATURDAY("6", "Saturday", 6),
    SUNDAY("7", "Sunday", 7);

    private final String id;
    private final String name;
    private final int order;

    WeekDay(final String id, final String name, final int order) {
        this.id = id;
        this.name = name;
        this.order = order;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getOrder() {
        return order;
    }

    @Override
    public String toString() {
        return "WeekDay{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", order=" + order +
                '}';
    }
}