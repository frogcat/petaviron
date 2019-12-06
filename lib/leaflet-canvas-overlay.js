(function() {

  L.CanvasOverlay = L.Layer.extend({
    options: {
      opacity: 1.0,
      interactive: true
    },
    initialize: function(options) {
      L.Util.setOptions(this, options);
    },
    setOpacity: function(opacity) {
      this.options.opacity = Math.min(1.0, Math.max(0.0, opacity));
      L.DomUtil.setOpacity(this._canvas, this.options.opacity);
    },
    getEvents: function() {
      return {
        zoom: this._reset,
        viewreset: this._reset,
        moveend: this._reset,
        resize: this._resize
      };
    },
    onAdd: function(map) {
      this._canvas = document.createElement("canvas");
      this.getPane().appendChild(this._canvas);
      if (this.options.interactive) {
        L.DomUtil.addClass(this._canvas, 'leaflet-interactive');
        this.addInteractiveTarget(this._canvas);
      }
      this._resize();
      this._reset(true);
    },
    onRemove: function(map) {
      L.DomUtil.remove(this._canvas);
      if (this.options.interactive) {
        this.removeInteractiveTarget(this._canvas);
      }
    },
    _resize: function() {
      if (this._map && this._canvas) {
        var s = this._map.getSize();
        this._canvas.width = s.x;
        this._canvas.height = s.y;
        this._canvas.style.width = s.x + "px";
        this._canvas.style.height = s.y + "px";
        this._reset(true);
      }
    },
    _reset: function(force) {
      if (!this._canvas || !this._map) return;
      var w = this._map.getSize().x;
      var h = this._map.getSize().y;
      L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]));
    },
    getCanvas: function() {
      return this._canvas;
    }
  });

  L.canvasOverlay = function() {
    return new L.CanvasOverlay();
  };


})();
