import cors from "cors";

import { env } from "./env.js";

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow mobile apps and server-to-server requests without an Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
});
