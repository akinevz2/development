#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
function usage() {
    console.log("Usage: node compare-newer.mjs <folderA> <folderB>");
}

const args = process.argv.slice(2);
if (args.length !== 2 || args.includes("-h") || args.includes("--help")) {
    usage();
    process.exit(args.length === 2 ? 0 : 2);
}

const folderA = path.resolve(args[0]);
const folderB = path.resolve(args[1]);

if (!fs.existsSync(folderA) || !fs.statSync(folderA).isDirectory()) {
    throw new Error(`Directory not found: ${folderA}`);
}

if (!fs.existsSync(folderB) || !fs.statSync(folderB).isDirectory()) {
    throw new Error(`Directory not found: ${folderB}`);
}

function listTopLevelRegularFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();
}

function mtimeSec(filePath) {
    return Math.floor(fs.statSync(filePath).mtimeMs / 1000);
}

function fmt(tsSec) {
    const d = new Date(tsSec * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate()),
    ].join("-") +
        " " +
        [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":");
}

const folderAFiles = listTopLevelRegularFiles(folderA);
const folderBFiles = listTopLevelRegularFiles(folderB);
const folderBSet = new Set(folderBFiles);

const common = folderAFiles.filter((name) => folderBSet.has(name));

let folderANewer = 0;
let folderBNewer = 0;
let same = 0;

console.log(`COMMON FILES: ${common.length}`);
console.log("");

for (const name of common) {
    const aPath = path.join(folderA, name);
    const bPath = path.join(folderB, name);

    const aTs = mtimeSec(aPath);
    const bTs = mtimeSec(bPath);

    let result;
    if (aTs > bTs) {
        result = `${folderA} newer`;
        folderANewer += 1;
    } else if (bTs > aTs) {
        result = `${folderB} newer`;
        folderBNewer += 1;
    } else {
        result = "same timestamp";
        same += 1;
    }

    console.log(name);
    console.log(`  ${folderA}: ${fmt(aTs)}`);
    console.log(`  ${folderB}: ${fmt(bTs)}`);
    console.log(`  result: ${result}`);
    console.log("");
}

function newestIn(dir, files) {
    let newestName = "";
    let newestTs = 0;

    for (const name of files) {
        const ts = mtimeSec(path.join(dir, name));
        if (ts > newestTs) {
            newestTs = ts;
            newestName = name;
        }
    }

    return { newestName, newestTs };
}

const newestA = newestIn(folderA, folderAFiles);
const newestB = newestIn(folderB, folderBFiles);

console.log("SUMMARY");
console.log(`${folderA} newer count: ${folderANewer}`);
console.log(`${folderB} newer count: ${folderBNewer}`);
console.log(`same timestamp count: ${same}`);
console.log("");
console.log(
    `Newest in ${folderA}: ${newestA.newestName} @ ${fmt(newestA.newestTs)}`
);
console.log(
    `Newest in ${folderB}: ${newestB.newestName} @ ${fmt(newestB.newestTs)}`
);

if (newestA.newestTs > newestB.newestTs) {
    console.log(`OVERALL: ${folderA} has the newer newest file.`);
} else if (newestB.newestTs > newestA.newestTs) {
    console.log(`OVERALL: ${folderB} has the newer newest file.`);
} else {
    console.log("OVERALL: newest timestamps are equal.");
}
