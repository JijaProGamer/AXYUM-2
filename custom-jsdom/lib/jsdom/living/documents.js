"use strict";
const XMLDocument = require("./generated/XMLDocument.js");
const Document = require("./generated/Document.js");
const { wrapperForImpl } = require("./generated/utils.js");

exports.createImpl = (globalObject, options, { alwaysUseDocumentClass = false } = {}) => {
  if (options.parsingMode === "xml" && !alwaysUseDocumentClass) {
    return XMLDocument.createImpl(globalObject, [], { options });
  }
  return Document.createImpl(globalObject, [], { options });
};

exports.createWrapper = (...args) => {
  return wrapperForImpl(exports.createImpl(...args));
};
