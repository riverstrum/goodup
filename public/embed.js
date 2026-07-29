(function () {
  var ORIGIN = (function () {
    var scripts = document.getElementsByTagName('script');
    var thisScript = scripts[scripts.length - 1];
    var src = thisScript && thisScript.src;
    if (!src) return '';
    var a = document.createElement('a');
    a.href = src;
    return a.protocol + '//' + a.host;
  })();

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render(el, article) {
    var pageUrl = ORIGIN + '/#/article/' + article.slug;
    var imgHtml = article.image
      ? '<div style="border-bottom:3px solid #008a96;overflow:hidden;"><img src="' + article.image + '" alt="" style="width:100%;display:block;max-height:220px;object-fit:cover;"></div>'
      : '';
    el.innerHTML =
      '<div style="border:3px solid #008a96;font-family:Georgia,serif;max-width:640px;">' +
      '<div style="background:#ffffff;border-bottom:2px solid #008a96;padding:6px 12px;font-family:Helvetica,Arial,sans-serif;font-weight:900;font-size:.7rem;letter-spacing:.05em;color:#008a96;">THE GOOD UP &middot; ' + escapeHtml(article.category || '') + '</div>' +
      imgHtml +
      '<div style="padding:16px;">' +
      '<div style="font-weight:900;font-size:1.4rem;line-height:1.15;margin-bottom:8px;"><a href="' + pageUrl + '" target="_blank" rel="noopener" style="color:#1a1a1a;text-decoration:none;">' + escapeHtml(article.title) + '</a></div>' +
      '<div style="font-style:italic;color:#333;margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;font-size:.95rem;">' + escapeHtml(article.dek) + '</div>' +
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:.75rem;color:#666;border-top:2px solid #008a96;padding-top:8px;margin-top:8px;">' +
      'Via ' + escapeHtml(article.source) + ' &mdash; <a href="' + article.source_url + '" target="_blank" rel="noopener" style="color:#008a96;">Read the full story &#8599;</a>' +
      '</div></div></div>';
  }

  function init() {
    var nodes = document.querySelectorAll('[data-goodup-article]');
    nodes.forEach(function (el) {
      var slug = el.getAttribute('data-goodup-article');
      fetch(ORIGIN + '/api/articles/' + encodeURIComponent(slug))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.article) render(el, data.article);
        })
        .catch(function () {
          el.textContent = 'Could not load story from THE GOOD UP.';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
