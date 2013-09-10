'use strict';


var _     = require('lodash');
var async = require('async');
var DOMParser = require('xmldom').DOMParser;
var ko = require('knockout');
// ke var svg2ttf = require('svg2ttf');
////////////////////////////////////////////////////////////////////////////////

//
// Import config
//
// str  - JSON data
// file - original file info
//
function import_config(str, file) {

  try {
    var config  = JSON.parse(str);
    var fontsByName = N.app.fontsList.fontsByName;

    N.app.fontName(config.name || '');
    N.app.cssPrefixText(String(config.css_prefix_text || 'icon-'));
    N.app.cssUseSuffix(config.css_use_suffix === true);
    N.app.hinting(config.hinting !== false);  // compatibility with old configs

    // reset selection prior to set glyph data
    _.each(N.app.fontsList.selectedGlyphs(), function (glyph) { glyph.selected(false); });

    // create map to lookup glyphs by id
    var glyphById = {};
    _.each(N.app.fontsList.fonts, function (font) {
      _.each(font.glyphs, function (glyph) {
        glyphById[glyph.uid] = glyph;
      });
    });

    _.each(config.glyphs, function (g) {

      if (!_.has(fontsByName, g.src)) { return; }

      var glyph = glyphById[g.uid];

      if (!glyph) { return; }

      glyph.selected(true);
      glyph.code(g.code || glyph.orig_code || glyph.originalCode);
      glyph.name(g.css || glyph.orig_css || glyph.originalName);
    });
  } catch (e) {
    N.wire.emit('notify', t('error.bad_config_format', { name: file.name }));
  }
}

function getUnicode(character) {
  if (character.length === 1) {
    // 2 bytes
    return character.charCodeAt(0);
  } else if (character.length === 2) {
    // 4 bytes
    var surrogate1 = character.charCodeAt(0);
    var surrogate2 = character.charCodeAt(1);
    /*jshint bitwise: false*/
    return ((surrogate1 & 0x3FF) << 10) + (surrogate2 & 0x3FF) + 0x10000;
  }
}

function getGlyph(elem, font, num, isMissed) {

  if (!isMissed) {
    // Ignore empty glyphs (with empty code or path)
    if (!elem.hasAttribute('d')) {
      return null;
    }
  }

  var glyph = {};

  glyph.isMissed = isMissed;
  glyph.d = elem.getAttribute('d') || '';
  glyph.character = elem.getAttribute('unicode') || String.fromCharCode(0);
  glyph.unicode = getUnicode(glyph.character) || num;
  glyph.name = elem.getAttribute('glyph-name') || ('item' + glyph.unicode);

  if (elem.getAttribute('horiz-adv-x')) {
    glyph.width = _.parseInt(+elem.getAttribute('horiz-adv-x'));
  }

  return glyph;
}

//
//generete unid glif
//
function generate_unid()
{
  var last;
  var letters='abcdef1234567890';
  var count=letters.length;
  var intval = Math.round(new Date().getTime());
  var result='';
  result=intval;
  var rnd=0;
   var i = 1;
  for(i=0;i<19;i++) {
        rnd=Math.floor(Math.random() * (16 - 0 + 0)) + 0 ;
        result+=letters[rnd];
                     }
return result;
}

//
// Import svg. Try to determine content & call appropriate parsers
//
// data - byte array with svg content
// file - original file info
//
function import_svg(str, file) {

  try {
   //var ttf = svg2ttf(fs.readFileSync('myfont.svg'));
    var doc = (new DOMParser()).parseFromString(str, "application/xml");
 
  var metadata = doc.getElementsByTagName('metadata')[0];
  var fontElem = doc.getElementsByTagName('font')[0];
  var fontFaceElem = fontElem.getElementsByTagName('font-face')[0];

  var font = {
    id: fontElem.getAttribute('id') || 'fontello',
    familyName: fontFaceElem.getAttribute('font-family') || 'fontello',
    glyphs: [],
    segments: [],
    missedGlyph: [],
    stretch: fontFaceElem.getAttribute('font-stretch') || 'normal'
  };
  
  var i = 1;
  _.forEach(fontElem.getElementsByTagName('glyph'), function (glyphElem) {

 var glyph = getGlyph(glyphElem, font, i, false);

if(glyph)
{

 N.app.fontsList.fonts[0].glyphs.push(new GlyphModel(N.app.fontsList.fonts[0],  {
        "css": "marquee",
        "code": Math.floor(Math.random() * (6 - 1 + 0)) + 1 ,
        "uid": generate_unid(),
        "search": [
          "marquee"
        ],
        "charRef": glyph.unicode!=undefined?glyph.unicode:65
      })); 
    
    }
  });

  } catch (e) {
    N.wire.emit('notify', t('error.bad_svg_format', { name: e.message }));
  }
}


//
// Import zip. Try to determine content & call appropriate parsers
//
// data - byte array with zipped content
// file - original file info
//
function import_zip(data, file) {
  try {
    var zip = new window.JSZip(data);

    // Try to search fontello config by known path
    // 'fontello-XXXXXX/config.json'. If exists - consider zip
    // as fontello archive & do config import.
    var search = zip.file(/fontello-[0-9a-f]+[\\/]config[.]json/);
    if ((search.length === 1) && (search[0].options.dir === false)) {
      import_config(search[0].data);
      return;
    }

    // If not fontello archive - scan it and try to import everything known
    _.each(zip.files, function(f) {
      // Currently show error for all entries
      N.wire.emit('notify', t('error.unknown_format', { name: f.name }));
    });
  } catch (e) {
    N.wire.emit('notify', t('error.bad_zip', { name: file.name }));
  }
}


// Int to char, with fix for big numbers
// see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/fromCharCode
//
function fixedFromCharCode(code) {
  /*jshint bitwise: false*/
  if (code > 0xffff) {
    code -= 0x10000;

    var surrogate1 = 0xd800 + (code >> 10)
      , surrogate2 = 0xdc00 + (code & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  } else {
    return String.fromCharCode(code);
  }
}


function GlyphModel(font, data) {

  // Read-only properties
  //
  this.uid          = data.uid;
  this.originalName = data.css;
  this.originalCode = data.code;

  //
  // Helper properties
  //

  this.font = font;

  // we search by name AND aliases
  this.keywords = [this.originalName].concat(data.search || []).join(',');

  this.charRef = fixedFromCharCode(data.charRef);
  this.cssExt  = data['css-ext'];
  this.tooltip = "name: '" + this.originalName + "'" +
                 (data.search ? ',   tags: ' + data.search.join(', ') : '');

  //
  // Actual properties state
  //

  this.selected = ko.observable(false);
  this.name     = ko.observable(this.originalName);
  this.code     = ko.observable(this.originalCode);

  this.selected.subscribe(function () {
    N.wire.emit('session_save');
  });

  this.name.subscribe(function () {
    N.wire.emit('session_save');
  });

  this.code.subscribe(function () {
    N.wire.emit('session_save');
  });

  // Serialization. Make sure to update this method to have
  // desired fields sent to the server (by font builder).
  //
  this.serialize = function () {
    return {
      uid:  this.uid
    , css:  this.name()
    , code: this.code()
    , src:  this.font.fontname
    };
  }.bind(this);

  //
  // Helpers
  //

  this.toggleSelection = function () {
    this.selected(!this.selected());
  }.bind(this);

  // Visibility depends only on search string:
  // - if pattern is too short (0 or 1 symbols)
  // - if pattern found in one of keywords
  //
  this.visible = ko.computed(function () {
    var word = N.app.searchWord();
    return (word.length < 2) || (0 <= this.keywords.indexOf(word));
  }, this);

  // code value as character (for code editor)
  //
  this.customChar = ko.computed({
    read: function () {
      return fixedFromCharCode(this.code());
    }
  , write: function (value) {
      this.code(fixedCharCodeAt(value));
    }
  , owner: this
  });

  // code value as hex-string (for code editor)
  //
  this.customHex = ko.computed({
    read: function () {
      var code = this.code().toString(16).toUpperCase();
      return "0000".substr(0, Math.max(4 - code.length, 0)) + code;
    }
  , write: function (value) {
      // value must be HEX string - omit invalid chars
      value = 0 + value.replace(/[^0-9a-fA-F]+/g, '');
      this.code(parseInt(value, 16));
    }
  , owner: this
  });

  // Whenever or not glyph should be treaten as "modified"
  //
  this.isModified = function () {
    return this.selected() ||
      (this.name() !== this.originalName) ||
      (this.code() !== this.originalCode);
  }.bind(this);

  // Register glyph in the names/codes swap-remap handlers.
  //
 // codesTracker.observe(this);
 // namesTracker.observe(this);
}

// Handles change event of file input
//
function handleFileSelect(event) {
  event.stopPropagation();
  event.preventDefault();

 

  var files = [];

  // Extract files list
  if (event.dataTransfer && event.dataTransfer.files) {
    // Got files via mouse drop
    files = event.dataTransfer.files;
  } else if (event.target && event.target.files) {
    // Got files via dialog
    files = event.target.files;
  }

  if (files === []) { 
    // Unexpected behavior. Should not happen in real life.
    N.wire.emit('notify', t('error.no_files_chosen'));
    return;
  }

  try {
    async.map(files,
      function (file, next) {
        var reader = new FileReader();

        // that's not needed, but should not be missed
        reader.onerror = next;
        reader.onabort = next;

        //
        // Try to detect file type, and call appropriate reader
        // and importer
        //

        // Chrome omits type on JSON files, so check it by extention
        if (file.name.match(/[.]json$/)) {
          reader.onload = function (e) {
            import_config(e.target.result, file);
            next();
          };
          reader.readAsText(file);
          return;
        }

        // 
        if (file.name.match(/[.]svg$/)) {
          reader.onload = function (e) {
            import_svg(e.target.result, file);
            next();
          };
          reader.readAsText(file);
          return;
        }

        if (file.type === 'application/zip') {
          reader.onload = function (e) {
            import_zip(e.target.result, file);
            next();
          };
          // Don't use readAsBinaryString() for IE 10 compatibility
          reader.readAsArrayBuffer(file);
          return;
        }

        // Unknown format - show error
        N.wire.emit('notify', t('error.unknown_format', { name: file.name }));
        next();
      },
      // final callback
      function () {
        // we must "reset" value of input field, otherwise Chromium will
        // not fire change event if the same file will be chosen twice, e.g.
        // import file -> made changes -> import same file
        if (event.target && event.target.files) { $(event.target).val(''); }
      }
    );
  } catch (err) {
    N.wire.emit('notify', t('error.invalid_browser'));
  }
}


////////////////////////////////////////////////////////////////////////////////


N.wire.once('navigate.done', function () {

  //
  // Create regular files selector
  //
  var $input = $('<input type="file">');

  // !!! WARNING !!!
  // Chrome does not triggers events, when element has "display: none"
  $input.css({
    visibility: 'hidden'
  , position:   'absolute'
  , left:       '-10000px'
  });

  // inject $el into body
  $input.appendTo('body');

  // listen input changes
  $input.on('change', handleFileSelect);

  // handle settings menu click -> open file dialog
  N.wire.on('import.start', function () {
    $input.click();
  });

  //
  // Setup global drag & drop zone
  //

  var dropZone = $('body');
  var dropProgress = false;

  // add the dataTransfer property for use with the native `drop` event
  // to capture information about files dropped into the browser window
  $.event.props.push("dataTransfer");

  dropZone.on('dragover', function (event) {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    if (!dropProgress) {
      dropZone.addClass('drop-progress');
      dropProgress = true;
    }
  });

  dropZone.on('dragleave', function () {
    dropZone.removeClass('drop-progress');
    dropProgress = false;
  });

  dropZone.on('drop', function (event) {
    dropZone.removeClass('drop-progress');
    dropProgress = false;
    handleFileSelect(event);
  });
});

//
// Setup import listener
//
N.wire.on('import.obj', function(obj) {
  import_config(JSON.stringify(obj), {});
});
