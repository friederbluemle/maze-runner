const express = require('express'),
    fs = require('fs'),
    path = require('path'),
    bugsnagDsym = require('@bugsnag-internal/bugsnag-dsym'),
    dSYMsDir = process.env.DSYMS_LOCATION,
    appName = process.env.APP_NAME;

let machoFiles = null;
let appFile = null;

if (typeof dSYMsDir == 'undefined') {
    throw Error("Environment variable DSYMS_LOCATION must be set.")
}

function getSymbolAddress(frameAddress, loadAddress, slide="0x100000000") {
    let relativeAddress = parseInt(frameAddress) - parseInt(loadAddress);
    let symbolAddress = relativeAddress + parseInt(slide);
    return "0x" + symbolAddress.toString(16).toUpperCase();
}

function getSymbolWithUUID(symbolAddress, machoUUID) {
    console.log(`Searching for symbol by uuid`);
    return new Promise((resolve, reject) => {
        let targetFile = machoFiles.find(machoFile => {
            return machoFile.uuid == machoUUID;
        });
        if (typeof targetFile == 'undefined') {
            reject("No matching file for UUID: " + machoUUID);
        } else {
            resolve(targetFile);
        }
    }).then(targetFile => {
        return targetFile.machoObj.section(machoUUID).dwarfLookupAsync(symbolAddress)
    });
}

function getSymbolFromApp(symbolAddress) {
    console.log(`Searching for symbol in app file`);
    return new Promise((resolve, reject) => {
        let targetFile = machoFiles.find(machoFile => {
            return machoFile.file == appFile;
        });
        if (typeof targetFile == 'undefined') {
            reject("Could not locate appFile");
        } else {
            resolve(targetFile);
        }
    }).then(targetFile => {
        return targetFile.machoObj.sections()[0].dwarfLookupAsync(symbolAddress)
    });
}

function populateMachoFiles(dsymsLocation) {
    return fs.readdirSync(dsymsLocation).filter(dsymFolder => {
        return fs.existsSync(path.join(dsymsLocation, dsymFolder, 'Contents', 'Resources', 'DWARF'));
    }).map(dsymFolder => {
        let dsymPath = path.join(dsymsLocation, dsymFolder, 'Contents', 'Resources', 'DWARF');
        let dsymName = fs.readdirSync(dsymPath)[0];
        let fullPath = path.join(dsymPath, dsymName);
        return new Promise((resolve, reject) => {
            bugsnagDsym.read(fullPath, (err, machoObj) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Adding dSYM file: ${dsymFolder}`);
                    if (dsymFolder.startsWith(appName)) {
                        console.log(`Setting app file: ${dsymFolder}`);
                        appFile = dsymFolder;
                    }
                    resolve({
                        file: dsymFolder,
                        machoObj: machoObj,
                        uuid: dsymFolder.substring(0, 36)
                    });
                }
            });
        });
    });
}
let app = express()

app.get('/symbolicate', (req, res) => {
    let frameAddress = req.query.frame_address,
        loadAddress = req.query.load_address,
        uuid = req.query.uuid,
        slide = req.query.slide;
    if (typeof slide == 'undefined') {
        var symbolAddress = getSymbolAddress(frameAddress, loadAddress);
    } else {
        var symbolAddress = getSymbolAddress(frameAddress, loadAddress, slide);
    }
    console.log(`Received symbolication request:`);
    console.log(`  frameAddress  : ${frameAddress}`);
    console.log(`  loadAddress   : ${loadAddress}`);
    console.log(`  uuid          : ${uuid}`);
    console.log(`  slide         : ${slide}`)
    console.log(`Calculated symbol address:`);
    console.log(`  symbolAddress : ${symbolAddress}`)
    if (typeof uuid == 'undefined') {
        var search = getSymbolFromApp(symbolAddress);
    } else {
        var search = getSymbolWithUUID(symbolAddress, uuid);
    }
    search.then(symbols => {
        if (Object.keys(symbols) == 0) {
            console.log(`Symbol could not be found`);
            res.status(404).json({
                error: "No symbol could be found"
            });
        } else {
            console.log(`Returning found symbols`);
            res.status(200).json(symbols[symbolAddress]);
        }
    }).catch(error => {
        console.log(`Error retrieving symbol`);
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    });
});

let loadPromises = populateMachoFiles(dSYMsDir)
Promise.all(loadPromises).then(machoArray => {
    if (machoArray.length > 0) {
        machoFiles = machoArray;
        app.listen(3000, () => {
            console.log("Symbolicator listening on port 3000")
        })
    } else {
        throw Error("Macho files were not found in directory: " + dSYMsDir);
    }
}).catch(console.error);
