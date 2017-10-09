/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var fs = require('fs-extra');
var fileUpload = require('express-fileupload');
var uuid = require('node-uuid');
var gm = require('gm').subClass({
    imageMagick: true
});
var request = require('request');
var async = require("async");
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;

var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');


var totalAnalysisRequests = 0;
var completeAnalysisRequests = 0;

var rootDir = './uploads';
var MIN_TILE_SIZE = 200;

var WATSON_KEY = "THIS IS RECEIVED FROM CLIENT WHEN IMAGE UPLOADED";

//when upload is received this is updated
var visual_recognition = new VisualRecognitionV3({
    api_key: WATSON_KEY,
    version_date: '2016-05-19'
});

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

//setting up socket.io for realtime communication
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(fileUpload());

// serve the files out of ./public as our main files
app.use("/",express.static(__dirname + '/public'));
app.use('/uploads', express.static(rootDir));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

/*
Delete upload directory
*/
app.get('/delete-uploads', function(req, res) {
    

    fs.remove(rootDir, err => {
        if (err) return console.error(err);
        console.log("Removed dir: "+rootDir);
        res.send('Removed '+rootDir+' directory.');
        
        }); 
         
    
});

app.post('/file-upload', function(req, res) {
    var sampleFile;
    var id = uuid.v4();
    var sessionId = req.body.sessionId;
    completeAnalysisRequests = 0;

    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }

    var uploadDir = rootDir + "/" + id;
    var imagePath = uploadDir + "/image.jpg";
    var jsonPath = uploadDir + "/image.json";

    if (!fs.existsSync(rootDir)) {
        fs.mkdirSync(rootDir);
    }

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    var tileWidth = req.body.tileWidth ? req.body.tileWidth : MIN_TILE_SIZE;
    var tileHeight = req.body.tileHeight ? req.body.tileHeight : MIN_TILE_SIZE;
    WATSON_KEY = req.body.watsonApiKey;
    if (WATSON_KEY === undefined || WATSON_KEY === "")
    {
        WATSON_KEY="N/A";
    }
    visual_recognition = new VisualRecognitionV3({
        api_key: WATSON_KEY,
        version_date: '2016-05-19'
    });
            
    if (tileWidth < MIN_TILE_SIZE) {
        tileWidth = MIN_TILE_SIZE
    }
    if (tileHeight < MIN_TILE_SIZE) {
        tileHeight = MIN_TILE_SIZE
    }


    sampleFile = req.files.file;
    sampleFile.mv(imagePath, function(err) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('File uploaded!');
            //update(sessionId, "file uploaded and saved to " + imagePath)
            update(sessionId, "file uploaded")
            generateImageTiles(sessionId, {
                rootDir: rootDir,
                id: id,
                imagePath: imagePath,
                imageDir: uploadDir,
                tileWidth: tileWidth,
                tileHeight: tileHeight
            }, function(err, imageData) {
                if (err) {
                    update(sessionId, "parsing error: " + err.toString())
                } else {
                    //update(sessionId, "parsing complete")
                    var imageData = imageData;
                    imageData.imagePath = imagePath;
                    processImages(sessionId, imageData, function(updatedImageData) {
                        update(sessionId, "analysis complete")


                        var json = JSON.stringify(updatedImageData);

                        fs.writeFile(jsonPath, json, function(err) {
                            if (err) return update(sessionId, err);
                            //update(sessionId, 'wrote json data');

                            var result = {
                                imagePath: imagePath,
                                jsonPath: jsonPath
                            }
                            dispatch(sessionId, "processingComplete", JSON.stringify(result))
                        });

                    })
                }
            })
        }
    });
});

function getPosition(row,col)
{
    var positionDictionary = {};
    positionDictionary["11_1"]=[27,630];
    positionDictionary["10_1"]=[57,515];
    positionDictionary["9_1"]=[67,425];
    positionDictionary["8_1"]=[105,345];
    positionDictionary["7_1"]=[118,278];
    positionDictionary["6_1"]=[131,216];
    positionDictionary["5_1"]=[151,165];
    positionDictionary["4_1"]=[163,121];
    positionDictionary["3_1"]=[185,77];
    positionDictionary["2_1"]=[194,42];
    positionDictionary["1_1"]=[217,0];

    positionDictionary["11_2"]=[826,704];
    positionDictionary["10_2"]=[816,589];
    positionDictionary["9_2"]=[733,422];
    positionDictionary["8_2"]=[712,338];
    positionDictionary["7_2"]=[699,266];
    positionDictionary["6_2"]=[676,209];
    positionDictionary["5_2"]=[642,156];
    positionDictionary["4_2"]=[597,106];
    positionDictionary["3_2"]=[586,67];
    positionDictionary["2_2"]=[568,28];
    positionDictionary["1_2"]=[550,0];
    //console.log(positionDictionary);
    return positionDictionary[row+"_"+col];
}


function  execChildProcessSync(image,tilesDir,row,col) {
    var position=getPosition(row,col);
    //console.log("position: "+position);
    var location="+"+position[0]+"+"+position[1];
    var childProcess1 = spawnSync("convert", [
                image,
                "-crop",
                "150x40"+location,
                tilesDir+"/tile_"+col+"_"+row+".jpg"
            ]);
    
    if(childProcess1.status != 0)
    {
        console.log("Executed process for location "+location+"; row "+row+"; col "+col);
        console.log("  Process pid: ",childProcess1.pid);
        console.log("  Process status: ",childProcess1.status);
        console.log("  Process signal: ",childProcess1.signal);
        console.log("  Process stdout: ",childProcess1.stdout.toString('utf8'));
        console.log("  Process stderr: ",childProcess1.stderr.toString('utf8'));
        console.log("  Process error: ",childProcess1.error);
    }
}


function generateImageTiles(sessionId, options, callback) {

    var imageSize = {};
    var parseData = {};
    parseData.tiles = [];
    parseData.tiles[0] = [];
    parseData.tiles[0][0] = {};
    //file path
    parseData.tiles[0][0].path = options.imagePath;
    var childProcessError = undefined;
    
    callback(childProcessError, parseData);
  /*  
    //var fileName = parseFileName(options.imagePath);
    var tilesDir = options.imagePath + "_tiles";
    var tileWidth = options.tileWidth;
    var tileHeight = options.tileHeight;

    if (!fs.existsSync(tilesDir)) {
        fs.mkdirSync(tilesDir);
    }

    var image = gm(options.imagePath)
        .size(function(err, size) {

            if (err) {
                callback(err);
                return;
            }


            imageSize = size;
            //modify for customer POC
            //var cols = Math.ceil(imageSize.width / tileWidth);
            //var rows = Math.ceil(imageSize.height / tileHeight);
            var cols = 2 // 2 "cols"
            var rows = 11 // 11 "rows"

            parseData.imageWidth = size.width;
            parseData.imageHeight = size.height;
            parseData.dimensions = {
                cols: cols,
                rows: rows
            }

            parseData.tiles = [];
            
            //var command =  options.imagePath + ' -write mpr:XY +delete -respect-parentheses ( mpr:XY -crop 150x40+27+630 +repage +write "'+tilesDir+'/tile_1_1.jpg" ) ';
            
            update(sessionId, "Invoke: converting images... ");
            console.log(sessionId, "Invoke: converting images... ");
            console.log(sessionId, " ");
            //console.log(sessionId, "Splitted args: " + command.split(" "));
            //var childProcess = spawn("convert", command.split(" "));
            //rows start from bottom left
            execChildProcessSync(options.imagePath,tilesDir,11,1)
            execChildProcessSync(options.imagePath,tilesDir,10,1)
            execChildProcessSync(options.imagePath,tilesDir,9,1)
            execChildProcessSync(options.imagePath,tilesDir,8,1)
            execChildProcessSync(options.imagePath,tilesDir,7,1)
            execChildProcessSync(options.imagePath,tilesDir,6,1)
            execChildProcessSync(options.imagePath,tilesDir,5,1)
            execChildProcessSync(options.imagePath,tilesDir,4,1)
            execChildProcessSync(options.imagePath,tilesDir,3,1)
            execChildProcessSync(options.imagePath,tilesDir,2,1)
            execChildProcessSync(options.imagePath,tilesDir,1,1)
            execChildProcessSync(options.imagePath,tilesDir,11,2)
            execChildProcessSync(options.imagePath,tilesDir,10,2)
            execChildProcessSync(options.imagePath,tilesDir,9,2)
            execChildProcessSync(options.imagePath,tilesDir,8,2)
            execChildProcessSync(options.imagePath,tilesDir,7,2)
            execChildProcessSync(options.imagePath,tilesDir,6,2)
            execChildProcessSync(options.imagePath,tilesDir,5,2)
            execChildProcessSync(options.imagePath,tilesDir,4,2)
            execChildProcessSync(options.imagePath,tilesDir,3,2)
            execChildProcessSync(options.imagePath,tilesDir,2,2)


            //do the last conversion, to trigger processing
            var position=getPosition(1,2);
            var location="+"+position[0]+"+"+position[1];
            var childProcess = spawn("convert", [
                options.imagePath,
                "-crop",
                "150x40"+location,
                tilesDir+"/tile_2_1.jpg"

            ]);

            var childProcessError = undefined;

            childProcess.stdout.on('data', function(data) {
                update(sessionId, `stdout: ${data}`);
                console.log(sessionId, `stdout: ${data}`);
            });

            childProcess.stderr.on('data', function(data) {
                update(sessionId, `stderr: ${data}`);
                console.log(sessionId, `stderr: ${data}`);
            });

            childProcess.on('error', function(err) {
                update(sessionId, `ERROR: ${err.toString()}`);
                console.log(sessionId, `ERROR: ${err.toString()}`);
                childProcessError = err;
            });

            childProcess.on('close', function(code) {
                update(sessionId, `child process exited with code ${code}`);
                //realtime.emit(`child process exited with code ${code}`);
                console.log(sessionId, `child process exited with code ${code}`);
                if (code == 0) {
                    for (var r = 0; r < rows; r++) {
                        //for (var c=0; c<cols; c++) {

                        if (parseData.tiles[r] == undefined) {
                            parseData.tiles[r] = [];
                        }

                        //loop over columns
                        for (var c = 0; c < cols; c++) {

                            if (parseData.tiles[r][c] == undefined) {
                                parseData.tiles[r][c] = {};
                            }

                            var x = c + 1 //* tileWidth;
                            var y = r + 1//* tileHeight;
                            var output = tilesDir + "/tile_" + x + "_" + y + ".jpg";

                            parseData.tiles[r][c].path = output;
                            parseData.tiles[r][c].size = {
                                width: 150,//Math.min(tileWidth, parseData.imageWidth - x),
                                height: 40//Math.min(tileHeight, parseData.imageHeight - y)
                            }
                            var position=getPosition(y,x)
                            parseData.tiles[r][c].position = {
                                x: position[0],
                                y: position[1]
                            }
                        }
                    }
                }

                callback(childProcessError, parseData);
            });

        });
*/


}





function processImages(sessionId, imageData, callback) {
    update(sessionId, "performing analysis on images...")

    //this is for debug
/*    if (1===1)
    {
        callback(imageData);
        return;
    }
*/
    totalAnalysisRequests = 0;
    completeAnalysisRequests = 0;
    var requests = [];

    //loop over cols
    for (var r = 0; r < imageData.tiles.length; r++) {

        //loop over rows
        for (var c = 0; c < imageData.tiles[r].length; c++) {

            var image = imageData.tiles[r][c];

            requests.push(analyzeImage(sessionId, image));

        }
    }



    async.parallelLimit(requests, 8, function() {
        totalAnalysisRequests++;
        callback(imageData);
    })

}









function analyzeImage(sessionId, _image) {
    totalAnalysisRequests++;
    return function(analyze_callback) {

        var fileName = _image.path;
        var analysis = {}

        var params = {
            images_file: fs.createReadStream(fileName)
        };

        update(sessionId, "detecting faces...");
        visual_recognition.detectFaces(params, function(err, res) {
            completeAnalysisRequests++;
            if (err) {
                update(sessionId, "Face Detection:" + JSON.stringify(err));
                analysis = {
                    error: err
                }
            } else {
                //update(sessionId, "Classified: " + completeAnalysisRequests + " of " + totalAnalysisRequests)
                analysis = res;
            }
            console.log("face detection: "+JSON.stringify(analysis, null, 2));
            _image.analysis = analysis;

            //call classify
            params = {
                images_file: fs.createReadStream(fileName)
                //classifier_ids: [WATSON_CLASSIFIER],
                //threshold: 0.0
            };
            update(sessionId, "classifying...");
            visual_recognition.classify(params, function(err, res) {

                completeAnalysisRequests++;
                if (err) {
                    update(sessionId, "Image Classifier: " + JSON.stringify(err));
                    analysis = {
                        error: err
                    }
                } else {
                    //update(sessionId, "Classified: " + completeAnalysisRequests + " of " + totalAnalysisRequests)
                    analysis = res;
                }
                console.log("classification: "+JSON.stringify(analysis, null, 2));
                _image.analysis_classify = analysis;
                    analyze_callback();
            });
            

        });



    }
}



io.on('connection', function(socket) {
    appSocket = socket
    console.log('a user connected');

    socket.on('disconnect', function() {
        console.log('user disconnected');
    });



    socket.on('upgrade', function(id) {
        console.log('upgrade event received for id: ' + id);
        socket.join(id);
        socketMap[id] = socket;
    });

});


var socketMap = {};

function update(id, data) {
    //console.log(data)
    if (id && socketMap[id]) {
        socketMap[id].emit("update", data)
    }
}


function dispatch(id, event, data) {
    //console.log(data)
    if (id && socketMap[id]) {
        socketMap[id].emit(event, data)
    }
}

// start the server
http.listen(appEnv.port, function() {
    // print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
});

