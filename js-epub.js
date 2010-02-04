(function (GLOBAL) {
    var JSEpub = function (blob) {
        this.blob = blob;
    }

    GLOBAL.JSEpub = JSEpub;

    JSEpub.prototype = {
        // For mockability
        unzipperConstructor: JSUnzip,
        inflater: JSInflate,

        unzipBlob: function () {
            var unzipper = new this.unzipperConstructor(this.blob);
            if (!unzipper.isZipFile()) {
                throw new Error("Provided file was not a zip file.");
            }

            unzipper.readEntries();
            this.entries = unzipper.entries;
        },

	readEntries: function () {
            this.files = {};

            for (var i = 0, il = this.entries.length; i < il; i++) {
                var entry = this.entries[i];
                var data;

                if (entry.compressionMethod === 0) {
                    data = entry.data;
                } else if (entry.compressionMethod === 8) {
                    data = this.inflater.inflate(entry.data);
                } else {
                    throw new Error("Unknown compression method "
                                    + entry.compressionMethod 
                                    + " encountered.");
                }

                if (entry.fileName === "META-INF/container.xml") {
                    this.container = data;
                } else if (entry.fileName === "mimetype") {
                    this.mimetype = data;
                } else {
                    this.files[entry.fileName] = entry.data;
                }
            }
        },

        getOpfPathFromContainer: function () {
            var doc = this.xmlDocument(this.container);
            return doc
                .getElementsByTagName("rootfile")[0]
                .getAttribute("full-path");
        },

        readOpf: function (xml) {
            var doc = this.xmlDocument(xml);
            
            try {
                var opf = {
                    metadata: {},
                    manifest: {},
                    spine: []
                };

                var metadataNodes = doc
                    .getElementsByTagName("metadata")[0]
                    .childNodes;

                for (var i = 0, il = metadataNodes.length; i < il; i++) {
                    var node = metadataNodes[i];
                    var key = node.nodeName.toLowerCase();
                    if (key === "#text") { continue }
                    var attrs = {};
                    for (var i2 = 0, il2 = node.attributes.length; i2 < il2; i2++) {
                        var attr = node.attributes[i2];
                        attrs[attr.name] = attr.value;
                    }
                    attrs._text = node.textContent;
                    opf.metadata[key] = attrs;
                }

                var manifestEntries = doc
                    .getElementsByTagName("manifest")[0]
                    .getElementsByTagName("item");

                for (var i = 0, il = manifestEntries.length; i < il; i++) {
                    var node = manifestEntries[i];
                    var attrs = {};
                    for (var i2 = 0, il2 = node.attributes.length; i2 < il2; i2++) {
                        var attr = node.attributes[i2];
                        if (attr.name === "id") { continue }
                        attrs[attr.name] = attr.value;
                    }
                    opf.manifest[node.getAttribute("id")] = attrs;
                }

                var spineEntries = doc
                    .getElementsByTagName("spine")[0]
                    .getElementsByTagName("itemref");

                for (var i = 0, il = spineEntries.length; i < il; i++) {
                    var node = spineEntries[i];
                    opf.spine.push(node.getAttribute("idref"));
                }

                return opf;
            } catch(e) {
                // The DOMParser will not throw an error if the XML is invalid.
                // It will return an XML error document, and it will be in
                // here:
                // doc.childNodes[1].childNodes[0].nodeValue
                throw(e)
            }
        },

        validate: function () {
            if (this.container === undefined) {
                throw new Error("META-INF/container.xml file not found.");
            }

            if (this.mimetype === undefined) {
                throw new Error("Mimetype file not found.");
            }

            if (this.mimetype !== "application/epub+zip") {
                throw new Error("Incorrect mimetype " + this.mimetype);
            }
        },

        xmlDocument: function (xml) {
            return new DOMParser().parseFromString(xml, "text/xml");
        }
    }
}(this));