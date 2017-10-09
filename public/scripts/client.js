var id = new Date().getTime();
var scaleSlider = undefined;

Dropzone.options.uploader = {
    acceptedFiles: "image/jpeg,image/jpg",
    uploadMultiple: false,
    sending: function(file, xhr, formData) {
        console.log("sending")
        formData.append('sessionId', id);
    },
    drop: function(event) {
        this.removeAllFiles();
        resetView();
    }
}


var io = io();
io.on('connect', function() {
    console.log("socket connect")

    io.emit('upgrade', id);
});


io.on('disconnect', function() {
    console.log('socket disconnect');
});


io.on('update', function(data) {
    var feedback = $("#feedback");
    var innerHTML = feedback.html();
    innerHTML += "<br/>" + data.toString();
    feedback.html(innerHTML);

    feedback.scrollTop(feedback.prop("scrollHeight"));
});

io.on("processingComplete", function(data) {
    console.log("processing complete");
    //renderResult(data);
    debug()
});

$(document).ready(function() {
    $("#sessionId").val(id);

    scaleSlider = $("#scaleSlider").bootstrapSlider();
    scaleSlider.bootstrapSlider()
    scaleSlider.on("change", function(event) {
        setContentScale(event.value.newValue);
    })

    $("#overlayToggle").change(function(event) {
        var checked = $(this).prop('checked')

        $("#render table").css('visibility', checked ? 'visible' : 'hidden');
    });

})




function debug() {
    renderResult('{"imagePath":"./uploads/06bd337d-2f60-4714-8bf8-08316615ea88/image.jpg","jsonPath":"./uploads/06bd337d-2f60-4714-8bf8-08316615ea88/image.json"}')
}

function resetView() {
    $("#render").empty();
    $("#feedback").html("");
}

function setContentScale(targetScale) {

    $("#render").css("transform", "scale(" + targetScale + ")")
    scaleSlider.bootstrapSlider('setValue', targetScale);
}

function renderResult(dataStr) {
    var data = JSON.parse(dataStr)
    console.log(data)

    var renderContainer = $("#render");

    //renderContainer.append($("<img class='' src='" + data.imagePath + "'  />"));

    $.ajax({
            type: 'GET',
            url: data.jsonPath
        })
        .done(function(result) {
            //console.log(result)
            var table = constructDiv(result,data.imagePath);
            console.log("table: "+table);
            renderContainer.append(table);

            $("#classification").removeClass("hidden");
            //$("#overlayToggle").bootstrapToggle('on');

            $("#legend").removeClass("hidden");
            $("#render-parent").removeClass("hidden");
            $("#footerControls").removeClass("hidden");
            $("#content").addClass("hidden");

/*
            var targetScale = $("#render-parent").width() / result.imageWidth
            setContentScale(targetScale);
            */
        })
        .fail(function(jqXHR, status) {
            console.log("Request failed: " + status);
        });
}

function constructDiv(data,imagePath) {
    console.log("constructDiv");
    console.log(JSON.stringify(data, null, 2));
//    <div style="position: relative; background: url(path to image); width: (width)px; height: (height)px;">
    var div = $("<div>");
    //div.css("position", "relative");
//    div.css("background", imagePath);
    var table = $("<table>");
    var row = $("<tr>");
    var cell = $("<td>");
    //cell.append($("<img class='' src='" + imagePath + "' width='50%' />"));
    cell.append($("<img class='' src='" + imagePath + "' />"));
    row.append(cell);
    table.append(row);  
    //table.append($("<tr>"));
    //table.append($("<td>"));
    //table.append($("<img class='' src='" + imagePath + "' width='50%' />"));
    //table.append($("</td></tr>"));
   
    //var faceDetectionData = $("<div>");
    console.log("");
    
    
    console.log(JSON.stringify(data.tiles[0][0].analysis.images, null, 2));
    image = data.tiles[0][0].analysis.images[0]
    console.log(JSON.stringify(image, null, 2));
        
    console.log(JSON.stringify(image.faces, null, 2));
    var facesLength=image.faces.length;
    //table.append($("<tr>"));
    //table.append($("<td>"));
    
    for (var i=0 ;i<facesLength ; i++)
    {
        row = $("<tr>");
        cell = $("<td>");
        facedata=image.faces[i];
        console.log(JSON.stringify(facedata, null, 2));
        var ageMin=facedata.age.min
        var ageMax=facedata.age.max
        var ageScore=facedata.age.score
        var gender=facedata.gender.gender
        var genderScore=facedata.gender.score
        cell.append($("<p>"+gender+" ("+genderScore+")<br/>Age: "+ageMin+" - "+ageMax+" ("+ageScore+")<br/></p>"));
        //cell.html=gender+" ("+genderScore+")<br/>Age: "+ageMin+" - "+ageMax+" ("+ageScore+")";
        row.append(cell);
        table.append(row);  
    }
    //table.append($("</td>"));
    //table.append($("</tr>"));
    //        console.log(JSON.stringify(face, null, 2));
        //div.append(face.age.min);
        //div.append("<br/>");
        //div.append(face.age.max);
    console.log("");
    //div.append(faceDetectionData);
    
    /*//    div.css("width", data.imageWidth);
//    div.css("height", data.imageHeight);


    var table = $("<table>");
    table.css("width", data.imageWidth);
    table.css("height", data.imageHeight);
    var row = $("<tr>");
    var tableData = $("<td>");



    var rows = data.tiles
    for (var r = 0; r < rows.length; r++) {
        var cols = data.tiles[r]
        //var row = $("<div>");

        for (var c = 0; c < cols.length; c++) {
            var cell = $("<div>");
            var cellData = cols[c];
            cell.css("position", "absolute");
            cell.css("width", cellData.size.width);
            cell.css("height", cellData.size.height);
            cell.css("top", cellData.position.y);
            cell.css("left", cellData.position.x);

            var style = getAnalysis(cellData);

            cell.css("background", style)

            cell.html(getConfidence(cellData));
            //div.append(cell);
            tableData.append(cell);
        }

        //div.append(row);
    }

    //tableData.append(div)
    row.append(tableData)
    table.append(row)
*/
    div.append(table);
    return div;
}


function constructTable_original(data) {
    var table = $("<table>");
    table.css("width", data.imageWidth);
    table.css("height", data.imageHeight);

    var rows = data.tiles
    for (var r = 0; r < rows.length; r++) {
        var cols = data.tiles[r]
        var row = $("<tr>");

        for (var c = 0; c < cols.length; c++) {
            var cell = $("<td>");
            var cellData = cols[c];
            cell.css("width", cellData.size.width);
            cell.css("height", cellData.size.height);

            var style = getAnalysis(cellData);

            cell.css("background", style)

            cell.html(getConfidence(cellData));
            row.append(cell);
        }

        table.append(row);
    }

    return table;
}

function getAnalysis(cellData) {
    if (cellData.analysis && cellData.analysis.images && cellData.analysis.images.length > 0) {
        var image = cellData.analysis.images[0];
        if (image && image.classifiers && image.classifiers.length > 0) {
            var classifier = cellData.analysis.images[0].classifiers[0]

            if (classifier && classifier.classes && classifier.classes.length > 0) {

                // this demo only visualizes the first classification within the first classifier
                // however could be modified to support multiple classifiers

                var classification = classifier.classes[0];
                return "rgba(0,255,0," + Math.min(classification.score * 2, 0.9) + ")"
            }
        }
    }
    return "rgba(0,0,0,0)"
}

function getConfidence(cellData) {
    if (cellData.analysis && cellData.analysis.images && cellData.analysis.images.length > 0) {
        var image = cellData.analysis.images[0];
        if (image && image.classifiers && image.classifiers.length > 0) {
            var classifier = cellData.analysis.images[0].classifiers[0]

            if (classifier && classifier.classes && classifier.classes.length > 0) {

                // this demo only visualizes the first classification within the first classifier
                // however could be modified to support multiple classifiers

                var classification = classifier.classes[0];
                return classification.score.toFixed(3)
            }
        }
    }
    return "-"
}