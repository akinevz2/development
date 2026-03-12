package ac.uk.sussex.kn253.service.ui;

public interface WidgetProvider<T extends WidgetProvider<T>> {
    Widget getWidget();
}
