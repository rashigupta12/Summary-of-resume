import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  
  // Custom config to match your client-side requirements
  // config: {
  //   fileTypes: ["pdf", "doc", "docx"],
  // },
});