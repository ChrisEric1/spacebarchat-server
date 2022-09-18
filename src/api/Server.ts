import { Config, getOrInitialiseDatabase, initEvent, registerRoutes, walk } from "@fosscord/util";
import { NextFunction, Request, Response, Router } from "express";
import { Server, ServerOptions, traverseDirectory } from "lambert-server";
import morgan from "morgan";
import path from "path";
import { red } from "picocolors";
import { Authentication, CORS } from "./middlewares/";
import { BodyParser } from "./middlewares/BodyParser";
import { ErrorHandler } from "./middlewares/ErrorHandler";
import { initRateLimits } from "./middlewares/RateLimit";
import TestClient from "./middlewares/TestClient";
import { initTranslation } from "./middlewares/Translation";
import { initInstance } from "./util/handlers/Instance";

export interface FosscordServerOptions extends ServerOptions {}

declare global {
	namespace Express {
		interface Request {
			// @ts-ignore
			server: FosscordServer;
		}
	}
}

export class FosscordServer extends Server {
	public declare options: FosscordServerOptions;

	constructor(opts?: Partial<FosscordServerOptions>) {
		// @ts-ignore
		super({ ...opts, errorHandler: false, jsonBody: false });
	}

	async start() {
		await getOrInitialiseDatabase();
		await Config.init();
		await initEvent();
		await initInstance();

		let logRequests = process.env["LOG_REQUESTS"] != undefined;
		if (logRequests) {
			this.app.use(
				morgan("combined", {
					skip: (req, res) => {
						let skip = !(process.env["LOG_REQUESTS"]?.includes(res.statusCode.toString()) ?? false);
						if (process.env["LOG_REQUESTS"]?.charAt(0) == "-") skip = !skip;
						return skip;
					}
				})
			);
		}

		this.app.use(CORS);
		this.app.use(BodyParser({ inflate: true, limit: "10mb" }));

		const app = this.app;
		const api = Router(); // @ts-ignore
		this.app = api;

		api.use(Authentication);
		await initRateLimits(api);
		await initTranslation(api);

		this.routes = await registerRoutes(this, path.join(__dirname, "routes", "/"));

		api.use("*", (error: any, req: Request, res: Response, next: NextFunction) => {
			if (error) return next(error);
			res.status(404).json({
				message: "404 endpoint not found",
				code: 0
			});
			next();
		});

		this.app = app;

		//app.use("/__development", )
		//app.use("/__internals", )
		app.use("/api/v6", api);
		app.use("/api/v7", api);
		app.use("/api/v8", api);
		app.use("/api/v9", api);
		app.use("/api", api); // allow unversioned requests

		let utils = walk(path.join(__dirname, "routes-util"));
		for (let file of utils) {
			const fullPath = file;
			file = file.replace(path.join(__dirname, "routes-util"), "");
			console.log(`[API] Registering util ${file}`);
			if(file.endsWith(".js") || file.endsWith(".ts") && !file.endsWith(".web.js")) {
				require(fullPath).default("/util/" + file.replace(".ts","").replace(".js", ""), app);
			}
			else {
				app.use("/util/"+file, (req, res) => {
					return res.sendFile(path.join(__dirname, "routes-util", file));
				})
			}
		}
		/*await traverseDirectory({dirname: }, (file) => {
			app.use("/" + file, (file.endsWith(".ts") || file.endsWith(".js")) ? require(file) : (req, res) => res.status(404).json({ message: "404 endpoint not found", code: 0 }));
		});*/

		this.app.use(ErrorHandler);
		TestClient(this.app);

		if (logRequests)
			console.log(
				red(
					`Warning: Request logging is enabled! This will spam your console!\nTo disable this, unset the 'LOG_REQUESTS' environment variable!`
				)
			);

		return super.start();
	}
}