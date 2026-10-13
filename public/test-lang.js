// Test page only: lets ?lang=de choose the widget language
var lang = new URLSearchParams(location.search).get('lang');
if (lang) document.documentElement.lang = lang;
