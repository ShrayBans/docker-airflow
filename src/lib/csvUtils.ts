import { parse } from "json2csv";
import * as _ from "lodash";

import { Client } from "pg";

const fs = require("fs");
const path = require("path");
const pg = require("pg");
const csvParse = require("csv-parse");
const stringify = require("csv-stringify");
const copyFrom = require("pg-copy-streams").from;

// NOTE: The fileName is solely the name and the filePath will be added programmatically
export function writeJsonToCsv(fileName, data, fields) {
    if (!Array.isArray(fields)) {
        console.error("The fields param must be an array");
        return;
    }
    const newLine = "\r\n";

    const relativeFilePath = __dirname + "/../../data/csv/" + fileName;

    fs.stat(relativeFilePath, function(err, stat) {
        if (err == null) {
            // console.log('File exists');

            const csv = parse(data, fields) + newLine;
            const csvWithoutHeader = _.tail(csv.split("\n")).join("\n");

            fs.appendFile(relativeFilePath, csvWithoutHeader, function(err) {
                if (err) throw err;
                // console.log('The "data to append" was appended to file!');
            });
        } else {
            //write the headers and newline
            // console.log('New file, writing headers');
            const csv = parse(data, fields) + newLine;

            fs.writeFile(relativeFilePath, csv, function(err) {
                if (err) throw err;
                // console.log('file saved');
            });
        }
    });
}

export async function loadCsvToPgTable(targetTable, csvPath, columns) {
    return new Promise(async (resolve, reject) => {
        const client = new Client({
            connectionString: "postgres://postgres:postgres@0.0.0.0:5500/sixthman_test",
        });
        client.connect();
        const coolPath = path.join(__dirname, csvPath);

        var stream = client.query(copyFrom(`COPY ${targetTable} FROM STDIN With CSV HEADER`));
        var fileStream = fs
            .createReadStream(coolPath)
            .pipe(
                csvParse({
                    delimiter: ",",
                    columns: columns,
                    // Use columns: true if the input has column headers
                    // Otherwise list the input field names in the array above.
                })
            )
            .pipe(
                stringify({
                    delimiter: ",",
                    relax_column_count: true,
                    skip_empty_lines: true,
                    header: true,
                    // This names the resulting columns for the output file.
                })
            );

        // fileStream.pipe(process.stdout);
        fileStream.pipe(stream);

        fileStream.on("error", error => {
            reject(`Error in creating read stream ${error}`);
        });
        stream.on("error", error => {
            reject(`Error in creating stream ${error}`);
        });
        stream.on("end", () => {
            client.end();
            resolve(`Completed loading data into ${targetTable}`);
        });
    });
}
