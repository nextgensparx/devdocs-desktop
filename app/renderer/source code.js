//SEARCH SCOPE

app.views.SearchScope = (function() {
  var HASH_RGX, SEARCH_PARAM;

  class SearchScope {
    constructor(el) {
      this.onResults = this.onResults.bind(this);
      this.reset = this.reset.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.afterRoute = this.afterRoute.bind(this);
      this.el = el;
    }

    init() {
      this.placeholder = this.input.getAttribute('placeholder');
      this.searcher = new app.SynchronousSearcher({
        fuzzy_min_length: 2,
        max_results: 1
      });
      this.searcher.on('results', this.onResults);
    }

    getScope() {
      return this.doc || app;
    }

    isActive() {
      return !!this.doc;
    }

    name() {
      var ref;
      return (ref = this.doc) != null ? ref.name : void 0;
    }

    search(value, searchDisabled = false) {
      if (this.doc) {
        return;
      }
      this.searcher.find(app.docs.all(), 'text', value);
      if (!this.doc && searchDisabled) {
        this.searcher.find(app.disabledDocs.all(), 'text', value);
      }
    }

    searchUrl() {
      var value;
      if (value = this.extractHashValue()) {
        this.search(value, true);
      }
    }

    onResults(results) {
      var doc;
      if (!(doc = results[0])) {
        return;
      }
      if (app.docs.contains(doc)) {
        this.selectDoc(doc);
      } else {
        this.redirectToDoc(doc);
      }
    }

    selectDoc(doc) {
      var previousDoc;
      previousDoc = this.doc;
      if (doc === previousDoc) {
        return;
      }
      this.doc = doc;
      this.tag.textContent = doc.fullName;
      this.tag.style.display = 'block';
      this.input.removeAttribute('placeholder');
      this.input.value = this.input.value.slice(this.input.selectionStart);
      this.input.style.paddingLeft = this.tag.offsetWidth + 10 + 'px';
      $.trigger(this.input, 'input');
      this.trigger('change', this.doc, previousDoc);
    }

    redirectToDoc(doc) {
      var hash;
      hash = location.hash;
      app.router.replaceHash('');
      location.assign(doc.fullPath() + hash);
    }

    reset() {
      var previousDoc;
      if (!this.doc) {
        return;
      }
      previousDoc = this.doc;
      this.doc = null;
      this.tag.textContent = '';
      this.tag.style.display = 'none';
      this.input.setAttribute('placeholder', this.placeholder);
      this.input.style.paddingLeft = '';
      this.trigger('change', null, previousDoc);
    }

    onKeydown(event) {
      if (event.which === 8) { // backspace
        if (this.doc && !this.input.value) {
          $.stopEvent(event);
          this.reset();
        }
      } else if (!this.doc && this.input.value) {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
          return;
        }
        if (event.which === 9 || (event.which === 32 && app.isMobile())) { // space
          this.search(this.input.value.slice(0, this.input.selectionStart));
          if (this.doc) {
            $.stopEvent(event);
          }
        }
      }
    }

    extractHashValue() {
      var newHash, value;
      if (value = this.getHashValue()) {
        newHash = $.urlDecode(location.hash).replace(`#${SEARCH_PARAM}=${value} `, `#${SEARCH_PARAM}=`);
        app.router.replaceHash(newHash);
        return value;
      }
    }

    getHashValue() {
      var ref;
      try {
        return (ref = HASH_RGX.exec($.urlDecode(location.hash))) != null ? ref[1] : void 0;
      } catch (error) {

      }
    }

    afterRoute(name, context) {
      if (!app.isSingleDoc() && context.init && context.doc) {
        return this.selectDoc(context.doc);
      }
    }

  };

  SEARCH_PARAM = app.config.search_param;

  SearchScope.elements = {
    input: '._search-input',
    tag: '._search-tag'
  };

  SearchScope.events = {
    keydown: 'onKeydown'
  };

  SearchScope.routes = {
    after: 'afterRoute'
  };

  HASH_RGX = new RegExp(`^#${SEARCH_PARAM}=(.+?) .`);

  return SearchScope;

}).call(this);

return;


// SEARCH

var ref;

app.views.Search = (function() {
  var HASH_RGX, SEARCH_PARAM;

  class Search {
    constructor() {
      this.focus = this.focus.bind(this);
      this.autoFocus = this.autoFocus.bind(this);
      this.onReady = this.onReady.bind(this);
      this.onInput = this.onInput.bind(this);
      this.searchUrl = this.searchUrl.bind(this);
      this.google = this.google.bind(this);
      this.stackoverflow = this.stackoverflow.bind(this);
      this.onResults = this.onResults.bind(this);
      this.onEnd = this.onEnd.bind(this);
      this.onClick = this.onClick.bind(this);
      this.afterRoute = this.afterRoute.bind(this);
    }

    init() {
      this.addSubview(this.scope = new app.views.SearchScope(this.el));
      this.searcher = new app.Searcher;
      this.searcher.on('results', this.onResults).on('end', this.onEnd);
      app.on('ready', this.onReady);
      $.on(window, 'hashchange', this.searchUrl);
      $.on(window, 'focus', this.autoFocus);
    }

    focus() {
      if (document.activeElement !== this.input) {
        this.input.focus();
      }
    }

    autoFocus() {
      var ref;
      if (!(app.isMobile() || $.isAndroid() || $.isIOS())) {
        if (((ref = document.activeElement) != null ? ref.tagName : void 0) !== 'INPUT') {
          this.input.focus();
        }
      }
    }

    getScopeDoc() {
      if (this.scope.isActive()) {
        return this.scope.getScope();
      }
    }

    reset(force) {
      if (force || !this.input.value) {
        this.scope.reset();
      }
      this.el.reset();
      this.onInput();
      this.autoFocus();
    }

    onReady() {
      this.value = '';
      this.delay(this.onInput);
    }

    onInput() {
      if ((this.value == null) || this.value === this.input.value) {
        return;
      }
      this.value = this.input.value;
      if (this.value.length) {
        this.search();
      } else {
        this.clear();
      }
    }

    search(url = false) {
      this.addClass(this.constructor.activeClass);
      this.trigger('searching');
      this.hasResults = null;
      this.flags = {
        urlSearch: url,
        initialResults: true
      };
      this.searcher.find(this.scope.getScope().entries.all(), 'text', this.value);
    }

    searchUrl() {
      var value;
      if (location.pathname === '/') {
        this.scope.searchUrl();
      } else if (!app.router.isIndex()) {
        return;
      }
      if (!(value = this.extractHashValue())) {
        return;
      }
      this.input.value = this.value = value;
      this.input.setSelectionRange(value.length, value.length);
      this.search(true);
      return true;
    }

    clear() {
      this.removeClass(this.constructor.activeClass);
      this.trigger('clear');
    }

    externalSearch(url) {
      var value;
      if (value = this.value) {
        if (this.scope.name()) {
          value = `${this.scope.name()} ${value}`;
        }
        $.popup(`${url}${encodeURIComponent(value)}`);
        this.reset();
      }
    }

    google() {
      this.externalSearch("https://www.google.com/search?q=");
    }

    stackoverflow() {
      this.externalSearch("https://stackoverflow.com/search?q=");
    }

    onResults(results) {
      if (results.length) {
        this.hasResults = true;
      }
      this.trigger('results', results, this.flags);
      this.flags.initialResults = false;
    }

    onEnd() {
      if (!this.hasResults) {
        this.trigger('noresults');
      }
    }

    onClick(event) {
      if (event.target === this.resetLink) {
        $.stopEvent(event);
        this.reset();
        app.document.onEscape();
      }
    }

    onSubmit(event) {
      $.stopEvent(event);
    }

    afterRoute(name, context) {
      var ref;
      if (((ref = app.shortcuts.eventInProgress) != null ? ref.name : void 0) === 'escape') {
        return;
      }
      if (!context.init && app.router.isIndex()) {
        this.reset(true);
      }
      if (context.hash) {
        this.delay(this.searchUrl);
      }
      this.delay(this.autoFocus);
    }

    extractHashValue() {
      var value;
      if ((value = this.getHashValue()) != null) {
        app.router.replaceHash();
        return value;
      }
    }

    getHashValue() {
      try {
        if ((ref = HASH_RGX.exec($.urlDecode(location.hash))) != null) {
          ref[1];
        }
      } catch (error) {

      }
    }

  };

  SEARCH_PARAM = app.config.search_param;

  Search.el = '._search';

  Search.activeClass = '_search-active';

  Search.elements = {
    input: '._search-input',
    resetLink: '._search-clear'
  };

  Search.events = {
    input: 'onInput',
    click: 'onClick',
    submit: 'onSubmit'
  };

  Search.shortcuts = {
    typing: 'focus',
    altG: 'google',
    altS: 'stackoverflow'
  };

  Search.routes = {
    after: 'afterRoute'
  };

  HASH_RGX = new RegExp(`^#${SEARCH_PARAM}=(.*)`);

  return Search;

}).call(this);

// LIST FOCUS

app.views.ListFocus = (function() {
  class ListFocus {
    constructor(el1) {
      this.blur = this.blur.bind(this);
      this.onDown = this.onDown.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onLeft = this.onLeft.bind(this);
      this.onEnter = this.onEnter.bind(this);
      this.onSuperEnter = this.onSuperEnter.bind(this);
      this.onClick = this.onClick.bind(this);
      this.el = el1;
      this.focusOnNextFrame = $.framify(this.focus, this);
    }

    focus(el) {
      if (el && !el.classList.contains(this.constructor.activeClass)) {
        this.blur();
        el.classList.add(this.constructor.activeClass);
        $.trigger(el, 'focus');
      }
    }

    blur() {
      var cursor;
      if (cursor = this.getCursor()) {
        cursor.classList.remove(this.constructor.activeClass);
        $.trigger(cursor, 'blur');
      }
    }

    getCursor() {
      return this.findByClass(this.constructor.activeClass) || this.findByClass(app.views.ListSelect.activeClass);
    }

    findNext(cursor) {
      var next;
      if (next = cursor.nextSibling) {
        if (next.tagName === 'A') {
          return next;
        } else if (next.tagName === 'SPAN') { // pagination link
          $.click(next);
          return this.findNext(cursor);
        } else if (next.tagName === 'DIV') { // sub-list
          if (cursor.className.indexOf('open') >= 0) {
            return this.findFirst(next) || this.findNext(next);
          } else {
            return this.findNext(next);
          }
        } else if (next.tagName === 'H6') { // title
          return this.findNext(next);
        }
      } else if (cursor.parentElement !== this.el) {
        return this.findNext(cursor.parentElement);
      }
    }

    findFirst(cursor) {
      var first;
      if (!(first = cursor.firstChild)) {
        return;
      }
      if (first.tagName === 'A') {
        return first;
      } else if (first.tagName === 'SPAN') { // pagination link
        $.click(first);
        return this.findFirst(cursor);
      }
    }

    findPrev(cursor) {
      var prev;
      if (prev = cursor.previousSibling) {
        if (prev.tagName === 'A') {
          return prev;
        } else if (prev.tagName === 'SPAN') { // pagination link
          $.click(prev);
          return this.findPrev(cursor);
        } else if (prev.tagName === 'DIV') { // sub-list
          if (prev.previousSibling.className.indexOf('open') >= 0) {
            return this.findLast(prev) || this.findPrev(prev);
          } else {
            return this.findPrev(prev);
          }
        } else if (prev.tagName === 'H6') { // title
          return this.findPrev(prev);
        }
      } else if (cursor.parentElement !== this.el) {
        return this.findPrev(cursor.parentElement);
      }
    }

    findLast(cursor) {
      var last;
      if (!(last = cursor.lastChild)) {
        return;
      }
      if (last.tagName === 'A') {
        return last;
      } else if (last.tagName === 'SPAN' || last.tagName === 'H6') { // pagination link or title
        return this.findPrev(last);
      } else if (last.tagName === 'DIV') { // sub-list
        return this.findLast(last);
      }
    }

    onDown() {
      var cursor;
      if (cursor = this.getCursor()) {
        this.focusOnNextFrame(this.findNext(cursor));
      } else {
        this.focusOnNextFrame(this.findByTag('a'));
      }
    }

    onUp() {
      var cursor;
      if (cursor = this.getCursor()) {
        this.focusOnNextFrame(this.findPrev(cursor));
      } else {
        this.focusOnNextFrame(this.findLastByTag('a'));
      }
    }

    onLeft() {
      var cursor;
      cursor = this.getCursor();
      if (cursor && !cursor.classList.contains(app.views.ListFold.activeClass) && cursor.parentElement !== this.el) {
        this.focusOnNextFrame(cursor.parentElement.previousSibling);
      }
    }

    onEnter() {
      var cursor;
      if (cursor = this.getCursor()) {
        $.click(cursor);
      }
    }

    onSuperEnter() {
      var cursor;
      if (cursor = this.getCursor()) {
        $.popup(cursor);
      }
    }

    onClick(event) {
      if (event.which !== 1 || event.metaKey || event.ctrlKey) {
        return;
      }
      if (event.target.tagName === 'A') {
        return this.focus(event.target);
      }
    }

  };

  ListFocus.activeClass = 'focus';

  ListFocus.events = {
    click: 'onClick'
  };

  ListFocus.shortcuts = {
    up: 'onUp',
    down: 'onDown',
    left: 'onLeft',
    enter: 'onEnter',
    superEnter: 'onSuperEnter',
    escape: 'blur'
  };

  return ListFocus;

}).call(this);

return;

// LIST SELECT

var ref,
  boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

ref = app.views.ListSelect = (function() {
  var ctor;

  class ListSelect extends app.View {
    constructor() {
      super(...arguments);
      this.onClick = this.onClick.bind(this);
      return ctor.apply(this, arguments);
    }

    deactivate() {}

    select(el) {
      this.deselect();
      if (el) {
        el.classList.add(this.constructor.activeClass);
        $.trigger(el, 'select');
      }
    }

    deselect() {
      var selection;
      if (selection = this.getSelection()) {
        selection.classList.remove(this.constructor.activeClass);
        $.trigger(selection, 'deselect');
      }
    }

    selectByHref(href) {
      var ref1;
      if (((ref1 = this.getSelection()) != null ? ref1.getAttribute('href') : void 0) !== href) {
        this.select(this.find(`a[href='${href}']`));
      }
    }

    selectCurrent() {
      this.selectByHref(location.pathname + location.hash);
    }

    getSelection() {
      return this.findByClass(this.constructor.activeClass);
    }

    onClick(event) {
      var target;
      boundMethodCheck(this, ref);
      if (event.which !== 1 || event.metaKey || event.ctrlKey) {
        return;
      }
      target = $.eventTarget(event);
      if (target.tagName === 'A') {
        return this.select(target);
      }
    }

  };

  ListSelect.activeClass = 'active';

  ListSelect.events = {
    click: 'onClick'
  };

  ctor = ListSelect.el;

  return ListSelect;

}).call(this);

return;

// SIDEBAR

var ref,
  boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

ref = app.views.Sidebar = (function() {
  class Sidebar extends app.View {
    constructor() {
      super(...arguments);
      this.resetHoverOnMouseMove = this.resetHoverOnMouseMove.bind(this);
      this.resetHover = this.resetHover.bind(this);
      this.showResults = this.showResults.bind(this);
      this.onReady = this.onReady.bind(this);
      this.onScopeChange = this.onScopeChange.bind(this);
      this.onSearching = this.onSearching.bind(this);
      this.onSearchClear = this.onSearchClear.bind(this);
      this.onFocus = this.onFocus.bind(this);
      this.onSelect = this.onSelect.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onAltR = this.onAltR.bind(this);
      this.onEscape = this.onEscape.bind(this);
      this.afterRoute = this.afterRoute.bind(this);
    }

    init() {
      if (!app.isMobile()) {
        this.addSubview(this.hover = new app.views.SidebarHover(this.el));
      }
      this.addSubview(this.search = new app.views.Search);
      this.search.on('searching', this.onSearching).on('clear', this.onSearchClear).scope.on('change', this.onScopeChange);
      this.results = new app.views.Results(this, this.search);
      this.docList = new app.views.DocList;
      app.on('ready', this.onReady);
      $.on(document.documentElement, 'mouseleave', (event) => {
        if (event.clientX < 10) {
          return this.display();
        }
      });
      $.on(document.documentElement, 'mouseenter', () => {
        return this.resetDisplay({
          forceNoHover: false
        });
      });
    }

    display() {
      this.addClass('show');
    }

    resetDisplay(options = {}) {
      if (!this.hasClass('show')) {
        return;
      }
      this.removeClass('show');
      if (!(options.forceNoHover === false || this.hasClass('no-hover'))) {
        this.addClass('no-hover');
        $.on(window, 'mousemove', this.resetHoverOnMouseMove);
      }
    }

    resetHoverOnMouseMove() {
      boundMethodCheck(this, ref);
      $.off(window, 'mousemove', this.resetHoverOnMouseMove);
      return $.requestAnimationFrame(this.resetHover);
    }

    resetHover() {
      boundMethodCheck(this, ref);
      return this.removeClass('no-hover');
    }

    showView(view) {
      var ref1, ref2;
      if (this.view !== view) {
        if ((ref1 = this.hover) != null) {
          ref1.hide();
        }
        this.saveScrollPosition();
        if ((ref2 = this.view) != null) {
          ref2.deactivate();
        }
        this.view = view;
        this.render();
        this.view.activate();
        this.restoreScrollPosition();
      }
    }

    render() {
      this.html(this.view);
    }

    showDocList() {
      this.showView(this.docList);
    }

    showResults() {
      boundMethodCheck(this, ref);
      this.display();
      this.showView(this.results);
    }

    reset() {
      this.display();
      this.showDocList();
      this.docList.reset();
      this.search.reset();
    }

    onReady() {
      boundMethodCheck(this, ref);
      this.view = this.docList;
      this.render();
      this.view.activate();
    }

    onScopeChange(newDoc, previousDoc) {
      boundMethodCheck(this, ref);
      if (previousDoc) {
        this.docList.closeDoc(previousDoc);
      }
      if (newDoc) {
        this.docList.reveal(newDoc.toEntry());
      } else {
        this.scrollToTop();
      }
    }

    saveScrollPosition() {
      if (this.view === this.docList) {
        this.scrollTop = this.el.scrollTop;
      }
    }

    restoreScrollPosition() {
      if (this.view === this.docList && this.scrollTop) {
        this.el.scrollTop = this.scrollTop;
        this.scrollTop = null;
      } else {
        this.scrollToTop();
      }
    }

    scrollToTop() {
      this.el.scrollTop = 0;
    }

    onSearching() {
      boundMethodCheck(this, ref);
      this.showResults();
    }

    onSearchClear() {
      boundMethodCheck(this, ref);
      this.resetDisplay();
      this.showDocList();
    }

    onFocus(event) {
      boundMethodCheck(this, ref);
      this.display();
      if (event.target !== this.el) {
        $.scrollTo(event.target, this.el, 'continuous', {
          bottomGap: 2
        });
      }
    }

    onSelect() {
      boundMethodCheck(this, ref);
      this.resetDisplay();
    }

    onClick(event) {
      var base;
      boundMethodCheck(this, ref);
      if (event.which !== 1) {
        return;
      }
      if (typeof (base = $.eventTarget(event)).hasAttribute === "function" ? base.hasAttribute('data-reset-list') : void 0) {
        $.stopEvent(event);
        this.onAltR();
      }
    }

    onAltR() {
      boundMethodCheck(this, ref);
      this.reset();
      this.docList.reset({
        revealCurrent: true
      });
      this.display();
    }

    onEscape() {
      var doc;
      boundMethodCheck(this, ref);
      this.reset();
      this.resetDisplay();
      if (doc = this.search.getScopeDoc()) {
        this.docList.reveal(doc.toEntry());
      } else {
        this.scrollToTop();
      }
    }

    onDocEnabled() {
      this.docList.onEnabled();
      this.reset();
    }

    afterRoute(name, context) {
      var ref1;
      boundMethodCheck(this, ref);
      if (((ref1 = app.shortcuts.eventInProgress) != null ? ref1.name : void 0) === 'escape') {
        return;
      }
      if (!context.init && app.router.isIndex()) {
        this.reset();
      }
      return this.resetDisplay();
    }

  };

  Sidebar.el = '._sidebar';

  Sidebar.events = {
    focus: 'onFocus',
    select: 'onSelect',
    click: 'onClick'
  };

  Sidebar.routes = {
    after: 'afterRoute'
  };

  Sidebar.shortcuts = {
    altR: 'onAltR',
    escape: 'onEscape'
  };

  return Sidebar;

}).call(this);

return;
