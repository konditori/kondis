import {
  DEFAULT_UNIT_SYSTEM,
  parseUnitSystem,
  UNIT_SYSTEM_COOKIE,
} from "$lib/units";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ cookies }) => ({
  unitSystem:
    parseUnitSystem(cookies.get(UNIT_SYSTEM_COOKIE)) ?? DEFAULT_UNIT_SYSTEM,
});
