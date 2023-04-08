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

/*eslint-env node*/

require("dotenv/config");
const path = require("path");
const fetch = require("node-fetch");
const http = require("http");
const https = require("https");
const fs = require("fs/promises");
const { existsSync } = require("fs");

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const agent = (_parsedURL) =>
	_parsedURL.protocol == "http:" ? httpAgent : httpsAgent;

const CACHE_PATH = path.join(__dirname, "..", "assets", "cache");
const BASE_URL = "https://discord.com";

const INSTANCE_NAME = process.env.CLIENT_PATCH_INSTANCE_NAME ?? "Fosscord";
const ONLY_CACHE_JS = process.env.ONLY_CACHE_JS ? true : false;

// Manual for now
const INDEX_SCRIPTS = [
	"6d6d9e430f57b7f651df.js",
	"a19b8ad80f950ad0fb1a.js",
	"a6f4952a67219a92c2a9.js",
	"72a8521aab60a87688f3.js",
	"532.7fbd5147ee8b816c530d.css",
	"4f91987a7b38426ef720.js",
	"abf9b56982d2eacb4e8e.js",
	"3ecba7af535756b7d6fd.js",
];

const doPatch = (content) => {
	return content;
};

const print = (x, printover = true) => {
	var repeat = process.stdout.columns - x.length;
	process.stdout.write(
		`${x}${" ".repeat(Math.max(0, repeat))}${printover ? "\r" : "\n"}`,
	);
};

const processFile = async (asset) => {
	asset = `${asset}${asset.includes(".") ? "" : ".js"}`;
	if (ONLY_CACHE_JS && !asset.endsWith(".js")) return [];

	const url = `${BASE_URL}/assets/${asset}`;
	const res = await fetch(url, { agent });
	if (res.status !== 200) {
		print(`${res.status} on ${asset}`, false);
		return [];
	}

	if (
		asset.includes(".") &&
		!asset.includes(".js") &&
		!asset.includes(".css")
	) {
		await fs.writeFile(path.join(CACHE_PATH, asset), await res.buffer());
		return [];
	}

	let text = await res.text();
	text = doPatch(text);

	await fs.writeFile(path.join(CACHE_PATH, asset), text);

	let ret = new Set([
		...(text.match(/"[A-Fa-f0-9]{20}"/g) ?? []),

		...[...text.matchAll(/\.exports=.\..\+"(.*?\..{0,5})"/g)].map(
			(x) => x[1],
		),

		...[...text.matchAll(/\/assets\/([a-zA-Z0-9]*?\.[a-z0-9]{0,5})/g)].map(
			(x) => x[1],
		),
	]);

	return [...ret].map((x) => x.replaceAll('"', ""));
};

(async () => {
	if (!existsSync(CACHE_PATH))
		await fs.mkdir(CACHE_PATH, { recursive: true });

	const assets = new Set(INDEX_SCRIPTS);
	let promises = [];

	let index = 0;
	for (let asset of assets) {
		index += 1;
		print(`Scraping asset ${asset}. Remaining: ${assets.size - index}`);

		promises.push(processFile(asset));
		if (promises.length > 100 || index == assets.size) {
			const values = await Promise.all(promises);
			promises = [];
			values.flat().forEach((x) => assets.add(x));
		}
	}

	print("done");
})();
