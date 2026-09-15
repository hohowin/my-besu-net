import express, { Express } from "express";
import { createRouter, RouterDeps } from "./routes";
import { errorHandler } from "./errorHandler";

export function createServer(deps: RouterDeps): Express {
  const app = express();
  app.use(express.json());
  app.use(createRouter(deps));
  app.use(errorHandler);
  return app;
}
