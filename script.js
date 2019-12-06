var map = L.map("map", L.extend({
  maxZoom: 20,
  center: [35.61748, 139.62071],
  zoom: 14
}, L.Hash.parseHash(location.hash)));

map.zoomControl.setPosition("bottomright");
map.attributionControl.setPrefix("<a href='https://github.com/frogcat/petaviron'>petaviron</a>");

L.hash(map);

L.control.layers({
  "GSI photo": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", {
    attribution: "<a href='http://maps.gsi.go.jp/development/ichiran.html'>GSI</a>",
    maxNativeZoom: 18,
    maxZoom: 20
  }).addTo(map),
  "GSI pale": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "<a href='http://maps.gsi.go.jp/development/ichiran.html'>GSI</a>",
    maxNativeZoom: 18,
    maxZoom: 20
  }),
  "GSI std": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
    attribution: "<a href='http://maps.gsi.go.jp/development/ichiran.html'>GSI</a>",
    maxNativeZoom: 18,
    maxZoom: 20
  }),
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; <a href='http://osm.org/copyright'>OpenStreetMap</a> contributors",
    maxNativeZoom: 18,
    maxZoom: 20
  })
}).addTo(map);

var popup = L.popup({
  closeButton: false,
  autoClose: false,
  closeOnEscapeKey: false,
  closeOnClick: false,
  className: "instruction"
});
popup.setLatLng(map.getCenter());
popup.setContent("<button id='start' class='gr'>Click me to overlay your image</button>");
popup.openOn(map);

map.on("moveend", function() {
  popup.setLatLng(map.getCenter());
});


$("#start").on("click", function() {
  $("<input type='file' accept='image/*'/>").change(function() {
    var file = Array.apply(null, this.files).find(function(f) {
      return f.type.indexOf("image/") === 0;
    });
    if (!file) return;
    var image = new Image();
    image.title = file.name;
    image.crossOrigin = "anonymous";
    image.onload = function() {
      window.URL.revokeObjectURL(image.src);
      init(image);
    };
    image.src = window.URL.createObjectURL(file);
  }).click();
});


function init(img) {
  map.closePopup();
  $("#control").fadeIn();

  var initialControlPoints = (function() {
    var size = map.getSize();
    var src = L.point(img.naturalWidth, img.naturalHeight);
    var dst = src.multiplyBy(Math.min(size.x / src.x * 0.8, size.y / src.y * 0.8, 1));
    var c = size.divideBy(2);
    var d = dst.divideBy(2);
    return [
      [0, 0, c.x - d.x, c.y - d.y],
      [src.x, 0, c.x + d.x, c.y - d.y],
      [src.x, src.y, c.x + d.x, c.y + d.y],
      [0, src.y, c.x - d.x, c.y + d.y]
    ];
  })();

  var markerGroup = L.featureGroup([]).addTo(map);
  var canvasOverlay = L.canvasOverlay({
    opacity: $("#opacity").val()
  }).addTo(map);

  var context = canvasOverlay.getCanvas().getContext("morph");

  canvasOverlay.on("click", function(e) {
    var p = context.getTexturePointAt(e.containerPoint.x, e.containerPoint.y);
    if (p === null) return;

    var button = document.createElement("button");
    button.setAttribute("class", "gr");
    button.appendChild(document.createTextNode("Click to remove"));
    var me = L.marker(e.latlng, {
      draggable: true,
      texturePoint: L.point(p[0], p[1])
    }).bindPopup(button).addTo(markerGroup);

    button.addEventListener("click", function() {
      markerGroup.removeLayer(me);
    });
  });

  markerGroup.on("layeradd layerremove change", function(e) {
    if (e.type === "layeradd") {
      e.layer.on("drag", function() {
        markerGroup.fire("change");
      });
    }
    context.clear();
    var markers = markerGroup.getLayers();
    if (markers.length < 3) return;
    context.drawImage(img, markers.map(marker => {
      var p = map.latLngToContainerPoint(marker.getLatLng());
      var q = marker.options.texturePoint;
      return [q.x, q.y, p.x, p.y];
    }));
  }).addTo(map);

  map.on("resize zoom viewreset moveend", function() {
    markerGroup.fire("change");
  });

  initialControlPoints.forEach(a => {
    L.marker(map.containerPointToLatLng([a[2], a[3]]), {
      draggable: true,
      texturePoint: L.point(a[0], a[1])
    }).bindPopup("<span class='gr'>drag me</span>").addTo(markerGroup).openPopup();
  });

  $("#opacity").on("input", function() {
    canvasOverlay.setOpacity($(this).val());
    $("#opacityText").text("opacity " + Math.floor(($(this).val() * 100)) + "%");
  }).trigger("input");

  $("#save").on("click", function() {

    if (!confirm("Are you sure to save?")) return;

    var natural = img.naturalWidth * img.naturalHeight;

    var bounds = markerGroup.getBounds();

    var tilejson = {
      "tilejson": "2.2.0",
      "scheme": "xyz",
      "tiles": [
        "./{z}/{x}/{y}.png"
      ],
      "minzoom": 100,
      "maxzoom": -1,
      "bounds": [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    };

    var coords = [];

    for (var zoom = 0; zoom < 21; zoom++) {
      var b = L.bounds(
        L.CRS.EPSG3857.latLngToPoint(bounds.getNorthWest(), zoom),
        L.CRS.EPSG3857.latLngToPoint(bounds.getSouthEast(), zoom)
      );
      var size = b.getSize();
      var actual = size.x * size.y;
      if ((actual < 0x100) || (actual > natural * 4)) continue;

      tilejson.minzoom = Math.min(tilejson.minzoom, zoom);
      tilejson.maxzoom = Math.max(tilejson.maxzoom, zoom);

      for (var y = Math.floor(b.min.y / 256); y <= Math.floor(b.max.y / 256); y++) {
        for (var x = Math.floor(b.min.x / 256); x <= Math.floor(b.max.x / 256); x++) {
          var p = L.point(x, y);
          p.z = zoom;
          coords.push(p);
        }
      }
    }

    var zip = new JSZip();

    var canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    var context = canvas.getContext("morph");

    var consume = function() {
      var origin = coords.pop();
      context.clear();
      context.drawImage(img, markerGroup.getLayers().map(marker => {
        var ll = marker.getLatLng();
        var p = L.CRS.EPSG3857.latLngToPoint(ll, origin.z).subtract(origin.multiplyBy(256));
        var q = marker.options.texturePoint;
        return [q.x, q.y, p.x, p.y];
      }));

      canvas.toBlob(function(blob) {
        var tilefilename = origin.z + "/" + origin.x + "/" + origin.y + ".png";
        zip.file(tilefilename, blob);
        if (coords.length > 0) {
          consume();
        } else {

          zip.file("tilejson.json", JSON.stringify(tilejson, null, 2));
          fetch("lib/template.html").then(a => a.text()).then(a => {
            zip.file("index.html", a);
            zip.generateAsync({
              type: "blob"
            }).then(function(blob) {
              saveAs(blob, "gr" + (new Date().getTime()) + ".zip");
            });
          });
        }
      });
    };
    consume();
  });

}
