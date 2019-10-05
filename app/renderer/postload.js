const sidebar = app.document.sidebar;
const searchObj = sidebar.subviews[1]
const scope = searchObj.scope;

function scopeSearch(value) {
  if (scope.doc) {
    return;
  }
  scope.searcher.find(app.docs.all(), 'text', value);
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
  return {doc, query};
}

const searchQueue = [];

scope.searcher.on('results', () => {
  console.log(location.href);
  if (searchQueue.length > 0 && searchQueue[0].doc) {
    search(searchQueue[0].query);
    searchQueue.splice(1);
  }
});

ipcOn('search', (e, query) => {
  const parsed = parseQuery(query)
  searchQueue.push(parsed);
  reset();
  console.log('query :', query);
  console.log('parsed :', parsed);
  console.log('current location :', location.href);
  if (parsed.doc) {
    scopeSearch(searchQueue[0].doc);
    console.log(location.href);
  } else {
    // don't wait for scope search results
    search(searchQueue[0].query);
    searchQueue.splice(1);
  }
})

