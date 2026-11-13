import { contrast } from "../../shared/schema";

/** Black or white, whichever reads better on `bg`. */
export const contrastText = (bg: string) => (contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111");
