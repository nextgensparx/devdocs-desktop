const sidebar = app.document.sidebar;
const searchObj = sidebar.subviews[1]
const scope = searchObj.scope;

function scopeSearch(value, searchDisabled = false) {
  if (scope.doc) {
    return;
  }
  scope.searcher.find(app.docs.all(), 'text', value);
  if (!scope.doc && searchDisabled) {
    scope.searcher.find(app.disabledDocs.all(), 'text', value);
  }
}

function search(value) {
  searchObj.input.value = searchObj.value = value;
  searchObj.input.setSelectionRange(value.length, value.length);

  searchObj.addClass(this.constructor.activeClass);
  searchObj.trigger("searching");

  searchObj.hasResults = null;
  searchObj.flags = { urlSearch: true, initialResults: true };
  searchObj.searcher.find(scope.getScope().entries.all(), "text", value);
}


function reset() {
  searchObj.reset();
  searchObj.scope.reset();
  searchObj.clear();
}

function parseQuery(str) {
  const result = new RegExp(`^(.+?) .`).exec(str)
  let doc = null;
  if (result != null) {
    doc = result[1];
  }

  let query = str;
  if (doc) {
    query = str.replace(`${doc} `, ``);
  }
  return [doc, query]
}

function protocolSearch(str) {
  const [doc, query] = parseQuery(str)
  reset();
  if (doc) {
    scopeSearch(doc);
  }
  search(query);
}
