import { Meme, StreamableLink } from "sixthman-objection-models";

import { instantiateKnex } from "../lib/knex";
import { runScript } from "../lib/runUtils";
import { get } from "lodash";

const Bluebird = require("bluebird");
var fs = require("fs");
const axios = require("axios");

runScript(bulkUploadTwitter);

/**
 * curl https://api.streamable.com/import?url=https://twitter.com/ComplexSports/status/1134896859502260225 -u $STREAMABLEUSER:$STREAMABLEPASSWORD
 */
async function bulkUploadTwitter() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    const twitterVideos = [
        { name: "Zion Can't Dunk Over Tacko Fall", url: "https://twitter.com/GSU_TIGERS/status/1110167642374066176" },
    ];

    await Bluebird.each(twitterVideos, async twitterVideo => {
        var username = process.env.STREAMABLEUSER;
        var password = process.env.STREAMABLEPASSWORD;
        var basicAuth = "Basic " + Buffer.from(username + ":" + password).toString("base64");

        const twitterUrl = get(twitterVideo, "url");
        let shortCode;
        try {
            const response = await axios.get(`https://api.streamable.com/import?url=${twitterUrl}`, {
                headers: { Authorization: basicAuth },
            });
            shortCode = get(response, "data.shortcode");
            console.log("res", get(response, "data.shortcode"));
        } catch (err) {
            console.log("err", get(err, "request._header"));
            console.log("err", get(err, "response.data"));
        }

        console.log("Created Streamable Link: " + `https://streamable.com/${shortCode}`);
        return StreamableLink.query().insertAndFetch({
            name: get(twitterVideo, "name"),
            link: `https://streamable.com/${shortCode}`,
            isModeratorCreated: true,
            isModeratorApproved: true,
            createdBy: 1,
        });
    });
}
