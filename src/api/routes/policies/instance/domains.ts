/*
	Fosscord: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Fosscord and Fosscord Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from "fs";
import { Router, Request, Response } from "express";
import { route } from "@fosscord/api";
import { Config } from "@fosscord/util";
const router = Router();
let websock = "";
if (fs.readFileSync("./tmp/PROT", { encoding: "utf8" }) == "https") {
	websock = "wss://" + fs.readFileSync("./tmp/HOST", { encoding: "utf8" });
} else if (fs.readFileSync("./tmp/PROT", { encoding: "utf8" }) == "http") {
	websock = "ws://" + fs.readFileSync("./tmp/HOST", { encoding: "utf8" });
} else {
	websock = "";
}
router.get("/", route({}), async (req: Request, res: Response) => {
	const { cdn, gateway, api } = Config.get();

	const IdentityForm = {
		cdn:
			process.env.CDN ||
			fs.readFileSync("./tmp/PROT", { encoding: "utf8" }) +
				"://" +
				fs.readFileSync("./tmp/HOST", { encoding: "utf8" }) ||
			"http://localhost:3001",
		gateway: websock || process.env.GATEWAY || "ws://localhost:3001",
		defaultApiVersion: api.defaultVersion ?? 9,
		apiEndpoint: api.endpointPublic ?? "/api",
	};

	res.json(IdentityForm);
});

export default router;
