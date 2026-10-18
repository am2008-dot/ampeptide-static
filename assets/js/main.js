// Mobile menu toggle, dropdown, and sticky header shadow
(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // close menu when a direct link is tapped (not the ABOUT parent toggle)
    nav.querySelectorAll('.menu > li > a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var li = a.parentElement;
        if (li.classList.contains('has-children') && window.innerWidth <= 900) {
          e.preventDefault();
          li.classList.toggle('open');
        } else {
          nav.classList.remove('open');
          toggle.classList.remove('open');
        }
      });
    });
  }

  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
