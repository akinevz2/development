package ac.uk.sussex.kn253.service.ui;

public class CellWidget implements Widget {

    String tag = "div";

    @Override
    public String content() {
        final var button = """
                <button class="cell-button">Button</button>
                """;
        return button;
    }

}
