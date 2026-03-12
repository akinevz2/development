package ac.uk.sussex.kn253.service.ui;

import java.util.List;
import java.util.Optional;

public interface HTMLTag {

    String tagName();

    default String content() {
        return "%s%s%s".formatted(openingTag(), innerContent(), closingTag());
    }

    default String innerContent() {
        return "";
    }

    default String openingTag() {
        return "<%s%s>".formatted(tagName(),
                parameters().map(list -> String.join(" ", list)).map(" %s"::formatted).orElse(""));
    }

    default String closingTag() {
        return "</%s>".formatted(tagName());
    }

    default Optional<List<String>> parameters() {
        return Optional.empty();
    }

}
