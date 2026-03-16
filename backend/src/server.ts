import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  // Keep startup logging simple for container logs.
  console.log(`wallet-backend listening on port ${env.port}`);
});
