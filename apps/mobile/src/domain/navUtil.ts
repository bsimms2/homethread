/** The slice of a navigation prop that leaveTo needs; any stack/tab prop satisfies it. */
interface LeaveNav {
  getState(): { routes: { name: string }[] } | undefined;
  dispatch(action: { type: string; payload?: object }): void;
}

/**
 * Leave an edit screen for the list under it.
 *
 * When a tab is entered straight at an edit screen (Home's "Snap a receipt"
 * button), that screen is the tab's only route: goBack() bounces to another
 * tab and the filled-in form stays alive, ready to be saved again. This pops
 * to the list when one exists and otherwise swaps the edit screen for it.
 */
export function leaveTo(nav: LeaveNav, listRoute: string): void {
  const routes = nav.getState()?.routes ?? [];
  if (routes.length > 1 && routes[0]?.name === listRoute) {
    nav.dispatch({ type: "POP_TO_TOP" });
  } else {
    nav.dispatch({ type: "REPLACE", payload: { name: listRoute } });
  }
}
