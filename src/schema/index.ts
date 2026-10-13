import { ObjectId } from "mongodb";
import { z } from "zod/v3";

const objectId = z.instanceof(ObjectId).optional()

export { objectId }