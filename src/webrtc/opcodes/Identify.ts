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
import { CLOSECODES, Payload, Send, WebSocket } from "@fosscord/gateway";
import {
	validateSchema,
	VoiceIdentifySchema,
	VoiceState,
} from "@fosscord/util";
import { endpoint, getClients, VoiceOPCodes, PublicIP } from "@fosscord/webrtc";
import SemanticSDP from "semantic-sdp";
import defaultSDP from "./sdp.json";

export async function onIdentify(this: WebSocket, data: Payload) {
	clearTimeout(this.readyTimeout);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { server_id, user_id, session_id, token, streams, video } =
		validateSchema("VoiceIdentifySchema", data.d) as VoiceIdentifySchema;

	const voiceState = await VoiceState.findOne({
		where: { guild_id: server_id, user_id, token, session_id },
	});
	if (!voiceState) return this.close(CLOSECODES.Authentication_failed);

	this.user_id = user_id;
	this.session_id = session_id;
	const sdp = SemanticSDP.SDPInfo.expand(defaultSDP);
	sdp.setDTLS(
		SemanticSDP.DTLSInfo.expand({
			setup: "actpass",
			hash: "sha-256",
			fingerprint: endpoint.getDTLSFingerprint(),
		}),
	);

	this.webrtcClient = {
		websocket: this,
		out: {
			tracks: new Map(),
		},
		in: {
			audio_ssrc: 0,
			video_ssrc: 0,
			rtx_ssrc: 0,
		},
		sdp,
		channel_id: voiceState.channel_id,
	};

	const clients = getClients(voiceState.channel_id);
	clients.add(this.webrtcClient);

	this.on("close", () => {
		if (this.webrtcClient) clients.delete(this.webrtcClient);
	});

	await Send(this, {
		op: VoiceOPCodes.READY,
		d: {
			streams: [
				// {
				// 	type: "video",
				// 	ssrc: this.webrtcClient.in.video_ssrc,
				// 	rtx_ssrc: this.webrtcClient.in.rtx_ssrc,
				// 	rid: "100",
				// 	quality: 100,
				// 	active: false,
				// },
			],
			ssrc: 1,
			port: fs.readFileSync("./tmp/PORT", { encoding: "utf8" }) || 3001,
			modes: [
				"aead_aes256_gcm_rtpsize",
				"aead_aes256_gcm",
				"aead_xchacha20_poly1305_rtpsize",
				"xsalsa20_poly1305_lite_rtpsize",
				"xsalsa20_poly1305_lite",
				"xsalsa20_poly1305_suffix",
				"xsalsa20_poly1305",
			],
			ip:
				fs.readFileSync("./tmp/IPv4", { encoding: "utf8" }) ||
				"0.0.0.0",
			experiments: [],
		},
	});
}
