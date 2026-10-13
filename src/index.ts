if (typeof window !== "undefined") {
    throw new Error(
        "This is a server-only module and cannot be imported into client-side code.",
    );
}

export { setEnv } from "./env";
export { z } from "zod/v3";
export { sanitize } from "./utils";
export { objectId } from "./schema";

import { create } from "./config";

export const mongo = {
    create,
};