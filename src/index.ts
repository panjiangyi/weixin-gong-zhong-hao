import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./routes.js";

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`WeChat MP API server starting on port ${port}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
  console.log(`\nAPI endpoints:`);
  console.log(`  GET/POST  /mpapi/getaccesstoken  - Get access token`);
  console.log(`  POST      /mpapi/addmaterial     - Upload cover image`);
  console.log(`  POST      /mpapi/uploadimage     - Upload inline image`);
  console.log(`  POST      /mpapi/draftadd        - Create draft`);
  console.log(`  POST      /mpapi/publish         - Publish (free/mass)`);
  console.log(`  POST      /mpapi/convert         - Markdown to WeChat HTML`);
  console.log(`  POST      /mpapi/full-publish    - All-in-one publish`);
});
