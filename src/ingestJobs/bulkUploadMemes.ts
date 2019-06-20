import { S3 } from "aws-sdk";
import * as Boom from "boom";
import * as _ from "lodash";
import { Meme } from "sixthman-objection-models";
import * as uuid from "uuid/v1";

import { instantiateKnex } from "../lib/knex";
import { runScript } from "../lib/runUtils";
import { s3PutObject } from "../lib/s3-helpers";

const CDN_BUCKET: string = process.env.CDN_BUCKET || "cdn.teamlegaci.com";
const ALLOWED_FILE_TYPES: string[] = ["image/jpg", "image/jpeg", "image/png", "image/gif"];
const FILE_TYPE_MAP: Object = {
    "image/jpg": "jpg",
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/gif": "gif",
};

const Bluebird = require("bluebird");
var fs = require("fs");

const dirPath = "/Users/bansalshray/Desktop/Legaci/docker-airflow/downloads/nba_draft";
var filePaths = fs.readdirSync(dirPath);

runScript(bulkUploadMemes);

async function bulkUploadMemes() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    await Bluebird.each(filePaths, async filePath => {
        const fullFilePath = `${dirPath}/${filePath}`;

        const fileData: { data: any; fileType: string } = await new Promise((resolve, reject) => {
            fs.readFile(fullFilePath, function(err, data) {
                if (err) {
                    return reject(err);
                }
                let fileType;
                if (_.endsWith(filePath, "jpg") || _.endsWith(filePath, "png") || _.endsWith(filePath, "gif")) {
                    fileType = "image/" + filePath.substr(filePath.length - 3);
                } else {
                    fileType = "image/jpg";
                }

                resolve({
                    fileType,
                    data,
                });
            });
        });

        const uploadedMeme = await bulkUploadMeme({ name: filePath }, fileData.data, fileData.fileType, true, 1);
        console.log(`Uploadeded Meme ${uploadedMeme.uploadedFileName}`);
    });
}

export async function bulkUploadMeme(
    meme: Partial<Meme>,
    fileData: any,
    fileType: string,
    isModeratorCreated: boolean,
    userId: number
): Promise<Meme> {
    const { name } = meme;
    const fileFormat: string = _.get(FILE_TYPE_MAP, fileType);

    const s3PathPrefix: string = "general";
    const s3path: string = `${s3PathPrefix}/${uuid()}.${fileFormat}`;
    const hasValidImageType: boolean = _.includes(ALLOWED_FILE_TYPES, fileType);

    if (!hasValidImageType) {
        throw Boom.unsupportedMediaType(`${fileType} content-type not allowed`);
    }

    const params: S3.Types.PutObjectRequest = {
        Bucket: CDN_BUCKET,
        Key: s3path,
        Body: fileData,
        ACL: "public-read",
    };

    await s3PutObject(CDN_BUCKET, s3path, params);

    return Meme.query().insertAndFetch({
        name,
        s3path,
        isModeratorCreated,
        createdBy: userId,
        uploadedFileName: name,
    });
}
