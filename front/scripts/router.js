function loadPage(page) {
  fetch(page)
    .then((r) => r.text())
    .then((html) => {
      document.getElementById("main-content").innerHTML = html;
    });
}
