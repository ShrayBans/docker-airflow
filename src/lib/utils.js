const json2csv = require('json2csv').parse;
const fs = require('fs');
const _ = require("lodash")


function getRandomInterval(min, range) {
    return Math.floor(Math.random() * (range || 10000)) + (min || 12000);
}

// NOTE: The fileName is solely the name and the filePath will be added programmatically
function writeJsonToCsv(fileName, data, fields) {
    if (!Array.isArray(fields)) {
        console.error("The fields param must be an array");
        return;
    }
    const newLine = "\r\n";

    const relativeFilePath = __dirname + "/../../data/csv/" + fileName

    fs.stat(relativeFilePath, function(err, stat) {
        if (err == null) {
            // console.log('File exists');

            const csv = json2csv(data, fields) + newLine;
            const csvWithoutHeader = _.tail(csv.split("\n")).join("\n")

            fs.appendFile(relativeFilePath, csvWithoutHeader, function(err) {
                if (err) throw err;
                // console.log('The "data to append" was appended to file!');
            });
        } else {
            //write the headers and newline
            // console.log('New file, writing headers');
            const csv = json2csv(data, fields) + newLine;

            fs.writeFile(relativeFilePath, csv, function(err, stat) {
                if (err) throw err;
                // console.log('file saved');
            });
        }
    });
}

module.exports = {
    getRandomInterval,
    writeJsonToCsv,
}